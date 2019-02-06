#!/bin/bash
read -n1 -p"Remove all local data? [y|N] " q; echo
if [ "$q" = 'y' ]; then
    pkill keosd
    pkill nodeos
    #rm -r wallet
    rm -r ~/eosio-wallet
    rm -r blockchain
    sleep 1
fi

./common.sh

read -n1 -p"Create accounts? [y|N] " q; echo
if [ "$q" = 'y' ]; then
    echo '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3' | cleos wallet import

    pubkey=$(cat ./pubkey.txt)
    cleos create account eosio eosio.token $pubkey -p eosio@active
    cleos create account eosio roulette $pubkey -p eosio@active
    cleos create account eosio alice $pubkey -p eosio@active

    git clone https://github.com/eosio/eosio.contracts
    eosio-cpp -I eosio.contracts/eosio.token/include/ -o eosio.token.wasm eosio.contracts/eosio.token/src/eosio.token.cpp --abigen
    mv eosio.token.wasm eosio.token.abi eosio.contracts/eosio.token/.
    cleos set contract eosio.token ./eosio.contracts/eosio.token/ -p eosio.token@active

    cleos push action eosio.token create '["eosio", "10000000000.0000 EOS"]' -p eosio.token@active
    cleos push action eosio.token issue '["eosio", "10000000000.0000 EOS", "issue eos"]' -p eosio@active
    cleos push action eosio.token transfer '{"from":"eosio","to":"roulette","quantity":"10000.0000 EOS","memo":"funding roulette"}' -p eosio@active
    cleos push action eosio.token transfer '{"from":"eosio","to":"alice","quantity":"10000.0000 EOS","memo":"funding alice"}' -p eosio@active
    cleos get currency balance eosio.token roulette
    cleos get currency balance eosio.token alice

    cleos set account permission roulette active '{"threshold":1,"keys":[{"key":"'$pubkey'","weight":1}],"accounts":[{"permission":{"actor":"roulette","permission":"eosio.code"},"weight":1}]}' owner -p roulette@owner
    cleos set account permission alice active '{"threshold":1,"keys":[{"key":"'$pubkey'","weight":1}],"accounts":[{"permission":{"actor":"roulette","permission":"eosio.code"},"weight":1}]}' owner -p alice@owner

    echo "window.roulette = {privkey: '$(cat privkey.txt)'};" > js/eosjs-privkey.js
fi

eosio-cpp -o roulette.wasm roulette.cpp --abigen
cleos set contract roulette ./ -p roulette@active
