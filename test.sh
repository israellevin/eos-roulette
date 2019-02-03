#!/bin/bash
./common.sh
cleos push action roulette deleteall '["roulette"]' -p roulette@owner

echo Available spins are
cleos get table roulette roulette spins
echo Standing bets are
cleos get table roulette roulette bets
echo Roulette has
cleos get currency balance eosio.token roulette
echo Alice has
cleos get currency balance eosio.token alice
echo Hit enter to create a spin
read

cleos push action roulette spin "[666, 1, $(date -d '+1 minute' +%s)]" -p roulette@owner
echo Available spins are
cleos get table roulette roulette spins
echo Hit enter to bet on this spin
read

for i in {0..100}; do
    cleos push action roulette bet "[\"alice\", 666, $((RANDOM % 37)), $((RANDOM % 10 + 1)), $RANDOM]" -p alice@owner
done
echo Standing bets are
cleos get table roulette roulette bets
echo Alice has
cleos get currency balance eosio.token alice
echo Roulette has
cleos get currency balance eosio.token roulette
echo Hit enter to pay winner
read

cleos push action roulette pay '[666]' -p roulette@owner
echo Hit enter to see final stats
read

echo Available spins are
cleos get table roulette roulette spins
echo Standing bets are
cleos get table roulette roulette bets
echo Roulette has
cleos get currency balance eosio.token roulette
echo Alice has
cleos get currency balance eosio.token alice
echo Thanks for playing
