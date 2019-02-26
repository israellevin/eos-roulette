#!/bin/bash
./common.sh
eosio-cpp -o galgal.wasm galgal.cpp --abigen
cleos set contract galgal ./ ./galgal.wasm ./galgal.abi -p galgal@active
