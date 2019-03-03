#!/bin/bash
./common.sh
cleos push action roulette deleteall '["roulette"]' -p roulette@active

status(){
    echo Available spins are
    cleos get table roulette roulette spins
    echo Standing bets are
    cleos get table roulette roulette bets
    echo Roulette has
    cleos get currency balance eosio.token roulette
    echo Alice has
    cleos get currency balance eosio.token alice
}

status
echo Hit enter to create a spin and bet on it
read

secret=$(openssl rand -hex 32)
hash="$(cleos push action -j roulette gethash '["'$secret'"]' -p roulette@active | grep -Po '(?<="console": ").*(?=\")')"
cleos push action roulette spin '["'$hash'", 1, '$(date -d '+6 seconds' +%s)']' -p roulette@active

for i in {0..90}; do
    cleos push action roulette bet '["alice", "'$hash'", ['$((RANDOM % 37))"], $((RANDOM % 10 + 1)), $i]" -p alice@active
done
for i in {0..10}; do
    cleos push action roulette bet '["alice", "'$hash'", ['$((RANDOM % 37))"], $((RANDOM % 10 + 1)), $i]" -p roulette@active
done
status
echo Hit enter to pay winners
read

while ! cleos push action roulette pay '["'$secret'"]' -p roulette@active; do sleep 1; done
echo Hit enter to see final stats
read

status
echo Thanks for playing
