#!/bin/bash
./common.sh
secretsdir=secrets
mkdir -p "$secretsdir"
paid=()
spun=()
bets=()
exec 2>errors.txt

pay(){
    result="$(cleos push action roulette pay '["'$(cat "$secretsdir/$1")'"]' -p roulette@owner)"
    ./announce_winner.py $1 $(echo "$result" | grep -Po '(?<="winning_number":)\d*') 2>errors.txt
    paid+=("$")
}

spin(){
    secret=$(openssl rand -hex 32)
    hash=$(cleos push action -j roulette gethash '["'$secret'"]' -p roulette@owner | grep -Po '(?<="console": ").*(?=\")')
    echo $secret > $secretsdir/$hash
    spun+=("$(cleos push action roulette spin '["'$hash'", '$(($(date +%s) - 10))', '$1']' -p roulette@owner)")
    bet $hash
}

bet(){
    bets+=("$(cleos push action roulette bet '["eosio.token", "'$1'", ['$((RANDOM % 37))"], $(( (RANDOM % 10 + 1) * 1000 )), $RANDOM]" -p roulette@active)")
    bets+=("$(cleos push action roulette bet '["eosio.stake", "'$1'", ['$((RANDOM % 37))"], $(( (RANDOM % 10 + 1) * 1000 )), $RANDOM]" -p roulette@active)")
    bets+=("$(cleos push action roulette bet '["eosio.upay", "'$1'", ['$((RANDOM % 37))"], $(( (RANDOM % 10 + 1) * 1000 )), $RANDOM]" -p roulette@active)")
}


# TODO display here the amount of funds in Roulette. At least we'll know that it's zero...

echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins

while :; do
    payable=$(\
        cleos get table roulette roulette spins --index 3 --key-type i64 -U $(date +%s) -l1 |\
        grep -Po '(?<="hash": ").*(?=\")')
    [ "$payable" ] || break;
    pay $payable
done

echo ${#paid[@]} paid
echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins

for i in $(seq 10 5 30); do
    spin $(date -d "+$i second" +%s)
done


echo ${#spun[@]} spun
echo ${#bets[@]} bets
echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins

cat errors.txt
> errors.txt
printf '%s\n' "${paid[@]}"
printf '%s\n' "${spun[@]}"
printf '%s\n' "${bets[@]}"
