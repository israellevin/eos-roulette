#!/bin/bash
./common.sh
for i in {0..999}; do
    echo $i 1>&2
    secret=$(openssl rand -hex 32)
    winner="$(cleos push action -j galgal calcwin '["'$secret'"]' -p galgal@owner | grep -Po '(?<="console": ").*(?=\")')"
    echo $winner
done | sort -n | uniq -c
