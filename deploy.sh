#!/bin/bash
read -n1 -p"Remove all local data? [y|N] " q; echo
[ "$q" == 'y' ] || exit 1

pkill keosd
pkill nodeos
rm -r blockchain
rm -r secrets
sleep 1

./common.sh

# eosio Dev key.
echo '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3' | cleos wallet import

# Create accounts.
pubkey=$(cat ./pubkey.txt)
for account in eosio.bpay eosio.msig eosio.names eosio.ram eosio.ramfee eosio.saving eosio.stake eosio.token eosio.upay; do
    cleos create account eosio $account $pubkey -p eosio@active
done

# Get and compile contracts.
git clone https://github.com/eosio/eosio.contracts
eosio-cpp -I eosio.contracts/eosio.bios/include/ -o eosio.bios.wasm eosio.contracts/eosio.bios/src/eosio.bios.cpp --abigen
mv eosio.bios.wasm eosio.bios.abi eosio.contracts/eosio.bios/.
cleos set contract eosio ./eosio.contracts/eosio.bios/ -p eosio@active

eosio-cpp -I eosio.contracts/eosio.token/include/ -o eosio.token.wasm eosio.contracts/eosio.token/src/eosio.token.cpp --abigen
mv eosio.token.wasm eosio.token.abi eosio.contracts/eosio.token/.
cleos set contract eosio.token ./eosio.contracts/eosio.token/ -p eosio.token@active

# Note that this seems to override the bios, as seen from `cleos get code eosio`.
eosio-cpp -I eosio.contracts/eosio.token/include/ -I eosio.contracts/eosio.system/include/ -o eosio.system.wasm eosio.contracts/eosio.system/src/eosio.system.cpp --abigen
mv eosio.system.wasm eosio.system.abi eosio.contracts/eosio.system/.
cleos set contract eosio ./eosio.contracts/eosio.system/ -p eosio@active

# Create token and distribute.
cleos push action eosio.token create '["eosio", "10000000000.0000 EOS"]' -p eosio.token@active
cleos push action eosio.token issue '["eosio", "10000000000.0000 EOS", "issue eos"]' -p eosio@active
# This init call is required, and can only happen after token is issued.
cleos push action eosio init '[0, "4,EOS"]' -p eosio@active

# Create, fund, and stake roulette and bettor accounts.
for account in roulette alice bob carol; do
    cleos system newaccount --stake-net '100.0000 EOS' --stake-cpu '100.0000 EOS' --buy-ram '100.0000 EOS' eosio $account $pubkey -p eosio@active
    cleos push action eosio.token transfer '{"from": "eosio", "to": "'$account'", "quantity": "1000000.0000 EOS", "memo": "funding '$account'"}' -p eosio@active
done

# Compile and set the roulette contract.
./compile.sh

 Give roulette token permissions for all bettors.
for account in roulette alice bob carol; do
    cleos set account permission $account active '{"threshold": 1, "keys": [{"key": "'$pubkey'", "weight":1}], "accounts": [{"permission": {"actor": "roulette", "permission": "eosio.code"}, "weight": 1}]}' owner -p $account@owner
done

# Put the chain ID in js file, for convenience.
echo "window.roulette = {chainid: '$(cat chainid.txt)'};" > www/js/eosjs-chainid.js

echo "Chain ID is:"
cat chainid.txt
echo "Private key is:"
cat privkey.txt
