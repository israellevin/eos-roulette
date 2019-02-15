#!/bin/bash
read -n1 -p"Remove all local data? [y|N] " q; echo
[ "$q" == 'y' ] || exit 1

pkill keosd
pkill nodeos
rm -r ~/eosio-wallet
rm -r blockchain
sleep 1

./common.sh

# eosio Dev key.
echo '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3' | cleos wallet import

# Create accounts.
pubkey=$(cat ./pubkey.txt)
cleos create account eosio eosio.token $pubkey -p eosio@active
cleos create account eosio eosio.system $pubkey -p eosio@active
cleos create account eosio roulette $pubkey -p eosio@active
cleos create account eosio alice $pubkey -p eosio@active

# Get and compile token contract.
git clone https://github.com/eosio/eosio.contracts
eosio-cpp -I eosio.contracts/eosio.token/include/ -o eosio.token.wasm eosio.contracts/eosio.token/src/eosio.token.cpp --abigen
mv eosio.token.wasm eosio.token.abi eosio.contracts/eosio.token/.
cleos set contract eosio.token ./eosio.contracts/eosio.token/ -p eosio.token@active

#compile system token
eosio-cpp -I eosio.contracts/eosio.system/include/ -I eosio.contracts/eosio.token/include/ -o eosio.system.wasm eosio.contracts/eosio.system/src/eosio.system.cpp --abigen
mv eosio.system.wasm eosio.system.abi eosio.contracts/eosio.system/.

# Create token and distribute.
cleos push action eosio.token create '["eosio", "10000000000.0000 EOS"]' -p eosio.token@active
cleos push action eosio.token issue '["eosio", "10000000000.0000 EOS", "issue eos"]' -p eosio@active
cleos push action eosio.token transfer '{"from":"eosio","to":"roulette","quantity":"10000.0000 EOS","memo":"funding roulette"}' -p eosio@active
cleos push action eosio.token transfer '{"from":"eosio","to":"alice","quantity":"10000.0000 EOS","memo":"funding alice"}' -p eosio@active

./compile.sh

# Give permissions.
cleos set account permission roulette active '{"threshold":1,"keys":[{"key":"'$pubkey'","weight":1}],"accounts":[{"permission":{"actor":"roulette","permission":"eosio.code"},"weight":1}]}' owner -p roulette@owner
cleos set account permission alice active '{"threshold":1,"keys":[{"key":"'$pubkey'","weight":1}],"accounts":[{"permission":{"actor":"roulette","permission":"eosio.code"},"weight":1}]}' owner -p alice@owner

# Put the chain ID in js file, for convenience.
echo "window.roulette = {chainid: '$(cat chainid.txt)'};" > js/eosjs-chainid.js

echo "Chain ID is:"
cat chainid.txt
echo "Private key is:"
cat privkey.txt