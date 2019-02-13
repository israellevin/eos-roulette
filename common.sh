#!/bin/bash
pushd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null
pgrep nodeos > /dev/null || nodeos -e -p eosio --data-dir blockchain --config-dir blockchain \
--plugin eosio::producer_plugin \
--plugin eosio::chain_api_plugin \
--plugin eosio::http_plugin \
--plugin eosio::history_plugin \
--plugin eosio::history_api_plugin \
--access-control-allow-origin='*' \
--contracts-console \
--http-validate-host=false \
--verbose-http-errors \
--filter-on='*' >> nodeos.log 2>&1 &

while ! cleos get code eosio > /dev/null; do sleep 1; done

if ! cleos wallet open; then
    cleos wallet create --file password.txt
    cleos wallet create_key | grep -Po '(?<=").*(?=\")' > pubkey.txt
    cleos wallet private_keys < password.txt | sed -n '3s/ *"\([^"]*\).*/\1/gp' > privkey.txt
    cleos get info | sed -n '3s/.*"\([^"]*\)",.*/\1/gp' > chainid.txt
fi

cleos wallet unlock < password.txt

popd > /dev/null
