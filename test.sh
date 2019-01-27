#!/bin/bash
#cleos wallet unlock < ~/eos/password.txt
#eosio-cpp -o roulette.wasm roulette.cpp --abigen
#cleos set contract roulette ~/eos/CONTRACTS_DIR/roulette/ -p roulette@owner
#cleos push action eosio.token transfer '{"from":"roulette","to":"alice","quantity":"0.0042 EOS","memo":"giving back to Alice"}' -p roulette@owner
#cleos push action eosio.token transfer '{"from":"alice","to":"roulette","quantity":"1.0000 EOS","memo":"giving back to Alice"}' -p alice@owner
#cleos push action roulette deleteall '["roulette"]' -p roulette@owner

echo Alice has
cleos get currency balance eosio.token alice
echo Roulette has
cleos get currency balance eosio.token roulette
echo Spins are
cleos get table roulette roulette spins
echo Bets are
cleos get table roulette roulette bets
read

cleos push action roulette spin "[666, 1, $(date -d '+1 minute' +%s)]" -p roulette@owner
echo Spins are
cleos get table roulette roulette spins
read

for i in {0..36}; do
    cleos push action roulette bet "[\"alice\", 666, $i, 42, $RANDOM]" -p alice@owner
done
echo Bets are
cleos get table roulette roulette bets
echo Alice has
cleos get currency balance eosio.token alice
echo Roulette has
cleos get currency balance eosio.token roulette
read

cleos push action roulette pay '[666]' -p roulette@owner
echo Alice has
cleos get currency balance eosio.token alice
echo Roulette has
cleos get currency balance eosio.token roulette
echo Spins are
cleos get table roulette roulette spins
echo Bets are
cleos get table roulette roulette bets
