#!/bin/bash
./common.sh
secretsdir=secrets
mkdir -p "$secretsdir"
paid=()
spun=()
errors=()

pay(){
    paid+=("$(cleos push action roulette pay '["'$(cat "$secretsdir/$1")'"]' -p roulette@owner)")
}

spin(){
    secret=$(openssl rand -hex 32)
    hash=$(cleos push action -j roulette gethash '["'$secret'"]' -p roulette@owner | grep -Po '(?<="console": ").*(?=\")')
    echo $secret > $secretsdir/$hash
    spun+=("$(cleos push action roulette spin '["'$hash'", '$(date +%s)', '$1']' -p roulette@owner)")
    sleep 0.1
    bet $hash
}

bet(){
    cleos push action roulette bet '["eosio.token", "'$1'", ['$((RANDOM % 37))"], $((RANDOM % 10 + 1)), $RANDOM]" -p roulette@active
    cleos push action roulette bet '["eosio.stake", "'$1'", ['$((RANDOM % 37))"], $((RANDOM % 10 + 1)), $RANDOM]" -p roulette@active
    cleos push action roulette bet '["eosio.upay", "'$1'", ['$((RANDOM % 37))"], $((RANDOM % 10 + 1)), $RANDOM]" -p roulette@active
}


echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins

while :; do
    payable=$(\
        cleos get table roulette roulette spins --index 3 --key-type i64 -U $(date +%s) -l1 |\
        grep -Po '(?<="hash": ").*(?=\")')
    [ "$payable" ] || break;
    pay $payable 2>errors.txt
done

echo ${#paid[@]} paid
echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins

for i in $(seq 10 10 60); do
    spin $(date -d "+$i second" +%s) 2>errors.txt
done


echo ${#spun[@]} spun
echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins

cat errors.txt
> errors.txt
printf '%s\n' "${paid[@]}"
printf '%s\n' "${spun[@]}"
