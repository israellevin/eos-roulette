#!/bin/bash
./common.sh
for i in {0..999}; do
    echo $i 1>&2
    seed=$(openssl rand -hex 32)
    winner="$(cleos push action -j roulette getwinner '["'$seed'"]' -p roulette@owner | grep -Po '(?<="console": ").*(?=\")')"
    echo $winner
done | sort -n | uniq -c
