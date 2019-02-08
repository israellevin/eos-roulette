#!/bin/bash
./common.sh
oldest=$(cleos get table roulette roulette spins --index 2 --key-type i64 -U $(date +%s) -l1 | sed -n '3s/.*: \(.*\),/\1/gp')
[ "$oldest" ] && cleos push action roulette pay "[$oldest]" -p roulette@owner
current=$(cleos get table roulette roulette spins --index 2 --key-type i64 -L $(date +%s) -l1 | sed -n '3s/.*: \(.*\),/\1/gp')
[ "$current" ] || cleos push action roulette spin "[$RANDOM, 1, $(date -d '+2 minute' +%s)]" -p roulette@owner

