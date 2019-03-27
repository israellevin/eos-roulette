#!/bin/bash
exec 2>errors.txt
./common.sh
secretsdir=secrets
mkdir -p "$secretsdir"
paid=()
spun=()
bets=()

countSpins(){
    echo $(cleos get table roulette roulette spins -l999 | grep -o '^ *"id": [[:digit:]]*,$' | wc -l) spins
}

pay(){
    result="$(cleos push action roulette pay '["'$(cat "$secretsdir/$1")'"]' -p roulette@owner || true)"
    winning_number="$(echo "$result" | grep -Po '(?<="winning_number":)\d*')"
    [ "$winning_number" ] || return
    paid+=("$result")
    ./announce_winner.py $1 $winning_number
}

bet(){
    bets+=("$(cleos push action roulette bet '["bob", "'$1'", ['$((RANDOM % 0 + 32))"], $(((RANDOM % 8 + 1) * 1000)), $RANDOM]" -p bob@active)")

    bets+=("$(cleos push action roulette bet '["bob", "'$1'", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], '"$(( (RANDOM % 8 + 1) * 1000 )), $RANDOM]" -p bob@active)")
    bets+=("$(cleos push action roulette bet '["carol", "'$1'", [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36], '"$(( (RANDOM % 8 + 1) * 1000 )), $RANDOM]" -p carol@active)")
    bets+=("$(cleos push action roulette bet '["bob", "'$1'", ['$((RANDOM % 37))"], $(((RANDOM % 8 + 1) * 1000)), $RANDOM]" -p bob@active)")
    bets+=("$(cleos push action roulette bet '["carol", "'$1'", ['$((RANDOM % 37))"], $(((RANDOM % 8 + 1) * 1000)), $RANDOM]" -p carol@active)")
    bets+=("$(cleos push action roulette bet '["bob", "'$1'", ['$((RANDOM % 37))"], $(((RANDOM % 8 + 1) * 1000)), $RANDOM]" -p bob@active)")
    bets+=("$(cleos push action roulette bet '["carol", "'$1'", ['$((RANDOM % 37))"], $(((RANDOM % 8 + 1) * 1000)), $RANDOM]" -p carol@active)")
    bets+=("$(cleos push action roulette bet '["bob", "'$1'", ['$((RANDOM % 37))"], $(((RANDOM % 8 + 1) * 1000)), $RANDOM]" -p bob@active)")
    bets+=("$(cleos push action roulette bet '["carol", "'$1'", ['$((RANDOM % 37))"], $(((RANDOM % 8 + 1) * 1000)), $RANDOM]" -p carol@active)")
    bets+=("$(cleos push action roulette bet '["bob", "'$1'", ['$((RANDOM % 37))"], $(((RANDOM % 8 + 1) * 1000)), $RANDOM]" -p bob@active)")
    bets+=("$(cleos push action roulette bet '["carol", "'$1'", ['$((RANDOM % 37))"], $(((RANDOM % 8 + 1) * 1000)), $RANDOM]" -p carol@active)")
}

spin(){
    secret=$(openssl rand -hex 32)
    hash=$(cleos push action -j roulette gethash '["'$secret'"]' -p roulette@owner | grep -Po '(?<="console": ").*(?=\")')
    echo $secret > $secretsdir/$hash
    spun+=("$(cleos push action roulette spin '["'$hash'", '$(($(date +%s) - 10))', '$1']' -p roulette@owner)")
    bet $hash
}

# Note exceptions on web.log
tail -50 web.log | grep -A20 'message handler error'

# Check balances
IFS=. read balance _ <<<"$(cleos get currency balance eosio.token roulette)"
if [ $balance -lt 100 ]; then
    echo 'LOW FUNDS!!!'
    exit 1
fi
for account in roulette alice bob carol; do echo -n "$account: "; cleos get currency balance eosio.token $account; done

countSpins

while :; do
    payable=$(\
        cleos get table roulette roulette spins --index 3 --key-type i64 -U $(date +%s) -l1 |\
        grep -Po '(?<="hash": ").*(?=\")')
    [ "$payable" ] || break;
    pay $payable
done

echo ${#paid[@]} paid
countSpins

for i in $(seq 10 25 60); do
    spin $(date -d "+$i second" +%s)
done


echo ${#spun[@]} spun
echo ${#bets[@]} bets
countSpins

cat errors.txt
printf '%s\n' "${paid[@]}"
printf '%s\n' "${spun[@]}"
printf '%s\n' "${bets[@]}"
