#!/bin/bash
./common.sh
cleos push action roulette deleteall '["roulette"]' -p roulette@owner

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

seed=$(openssl rand -hex 32)
seedhash="$(cleos push action -j roulette gethash '["'$seed'"]' -p roulette@owner | grep -Po '(?<="console": ").*(?=\")')"
cleos push action roulette spin '["'$seedhash'", 1, '$(date -d '+5 seconds' +%s)']' -p roulette@owner

for i in {0..100}; do
    cleos push action roulette bet '["alice", "'$seedhash'", ['$((RANDOM % 37))"], $((RANDOM % 10 + 1)), $i]" -p alice@active
done
status
echo Hit enter to pay winners
read

while ! cleos push action roulette pay '["'$seed'"]' -p roulette@owner; do sleep 1; done
echo Hit enter to see final stats
read

status
echo Thanks for playing
