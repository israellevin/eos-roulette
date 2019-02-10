#!/bin/bash
eosio-cpp -o roulette.wasm roulette.cpp --abigen
cleos set contract roulette ./ ./roulette.wasm ./roulette.abi -p roulette@active
