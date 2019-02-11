#!/bin/bash
./common.sh
seedsdir=seeds
mkdir -p "$seedsdir"

pay(){
    cleos push action roulette pay '["'$(cat "$seedsdir/$1")'"]' -p roulette@owner
}

spin(){
    seed=$(openssl rand -hex 32)
    seedhash=$(cleos push action -j roulette gethash '["'$seed'"]' -p roulette@owner | grep -Po '(?<="console": ").*(?=\")')
    echo $seed > seeds/$seedhash
    cleos push action roulette spin '["'$seedhash'", '$(date +%s)', '$1']' -p roulette@owner
}

cleos get table roulette roulette spins
while :; do
    oldest=$(cleos get table roulette roulette spins --index 3 --key-type i64 -U $(date +%s) -l1 | grep -Po '(?<="seedhash": ").*(?=\")')
    [ "$oldest" ] || break;
    pay $oldest
done
current=$(cleos get table roulette roulette spins --index 3 --key-type i64 -L $(date +%s) -l1 | grep -Po '(?<="seedhash": ").*(?=\")')
for i in {1..5}; do
    spin $(date -d "+$((RANDOM % 300 + 60)) second" +%s)
done
cleos get table roulette roulette spins
