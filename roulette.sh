#!/bin/bash
./common.sh
cleos get table roulette roulette spins
while :; do
    oldest=$(cleos get table roulette roulette spins --index 2 --key-type i64 -U $(date +%s) -l1 | sed -n '3s/.*: \(.*\),/\1/gp')
    [ "$oldest" ] || break;
    cleos push action roulette pay "[$oldest]" -p roulette@owner
done
current=$(cleos get table roulette roulette spins --index 2 --key-type i64 -L $(date +%s) -l1 | sed -n '3s/.*: \(.*\),/\1/gp')
for i in {1..5}; do
    cleos push action roulette spin "[$RANDOM, 1, $(date -d "+$((RANDOM % 100 + 30)) second" +%s)]" -p roulette@owner
done
cleos get table roulette roulette spins
