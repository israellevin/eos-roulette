#!/bin/sh
keosd&
pkill nodeos
nodeos -e -p eosio --plugin eosio::producer_plugin --plugin eosio::chain_api_plugin --plugin eosio::http_plugin --plugin eosio::history_plugin --plugin eosio::history_api_plugin --data-dir ~/eos/eosio/data --config-dir ~/eos/eosio/config --access-control-allow-origin='*' --contracts-console --http-validate-host=false --verbose-http-errors --filter-on='*' >> ~/eos/nodeos.log 2>&1 &

cleos wallet unlock < ~/eos/password.txt
cleos create account eosio roulette EOS7Zs4qaNryEVWySMG2Name6J4UQEy7rCGkBAUv19aEua6zLw7ck -p eosio@active

eosio-cpp -o roulette.wasm roulette.cpp --abigen
cleos set contract roulette ~/eos/CONTRACTS_DIR/roulette/ -p roulette@active
