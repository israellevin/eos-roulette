#!/usr/bin/env python3
import json
import requests

BASE_URL = 'http://api.eosnewyork.io:80'
BASE_HEADERS = {'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'}
INTERESTING_ACCOUNTS = ['eosio.token']

def process_block(block):
    for transaction in block['transactions']:
        if isinstance(transaction['trx'], dict):
            for action in transaction['trx']['transaction']['actions']:
                if action['account'] in INTERESTING_ACCOUNTS:
                    print(json.dumps(action, indent=4, sort_keys=True))

def read_block(block_id):
    url = "{}/v1/chain/get_block".format(BASE_URL)
    return requests.request("POST", url, headers=BASE_HEADERS, json={'block_num_or_id': block_id}).json()

if __name__ == '__main__':
    for block_id in range(43466700, 43466715):
        process_block(read_block(block_id))
