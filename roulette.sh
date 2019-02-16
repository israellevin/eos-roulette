#!/bin/bash
./common.sh
seedsdir=seeds
mkdir -p "$seedsdir"
paid=()
spun=()

pay(){
    paid+=("$(cleos push action roulette pay '["'$(cat "$seedsdir/$1")'"]' -p roulette@owner)")
}

spin(){
    seed=$(openssl rand -hex 32)
    seedhash=$(cleos push action -j roulette gethash '["'$seed'"]' -p roulette@owner | grep -Po '(?<="console": ").*(?=\")')
    echo $seed > seeds/$seedhash
    spun+=("$(cleos push action roulette spin '["'$seedhash'", '$(date +%s)', '$1']' -p roulette@owner)")
}


echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins

while :; do
    payable=$(\
        cleos get table roulette roulette spins --index 3 --key-type i64 -U $(date +%s) -l1 |\
        grep -Po '(?<="seedhash": ").*(?=\")')
    [ "$payable" ] || break;
    pay $payable 2>/dev/null
done

echo ${#paid[@]} paid
echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins

for i in $(seq 5 5 30); do
    spin $(date -d "+$i second" +%s) 2>/dev/null
done


echo ${#spun[@]} spun
echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins

printf '%s\n' "${paid[@]}"
printf '%s\n' "${spun[@]}"
