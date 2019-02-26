#!/bin/bash
./common.sh
cleos push action galgal deleteall '["galgal"]' -p galgal@owner

status(){
    echo Available spins are
    cleos get table galgal galgal spins
    echo Standing tarvuts are
    cleos get table galgal galgal tarvuts
    echo Galgal has
    cleos get currency balance eosio.token galgal
    echo Alice has
    cleos get currency balance eosio.token alice
}

status
echo Hit enter to create a spin and tarvut on it
read

secret=$(openssl rand -hex 32)
hash="$(cleos push action -j galgal gethash '["'$secret'"]' -p galgal@owner | grep -Po '(?<="console": ").*(?=\")')"
cleos push action galgal spin '["'$hash'", 1, '$(date -d '+5 seconds' +%s)']' -p galgal@owner

for i in {0..100}; do
    cleos push action galgal tarvut '["alice", "'$hash'", ['$((RANDOM % 37))"], $((RANDOM % 10 + 1)), $i]" -p alice@active
done
status
echo Hit enter to pay winners
read

while ! cleos push action galgal pay '["'$secret'"]' -p galgal@owner; do sleep 1; done
echo Hit enter to see final stats
read

status
echo Thanks for playing
