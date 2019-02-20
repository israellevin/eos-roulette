#!/usr/bin/env python3
'Get actions from EOS blockchain in real time.'
import requests

import demuxeos

NODE = 'https://api.eosnewyork.io'


def store_data(*args, **kwargs):
    'Store block data in a data store.'
    print('I would store this, but I am not yet implemented', args, kwargs)


def scan_transaction(transaction):
    'Scan a transaction for interesting data.'
    print(transaction['trx'].keys())


def scan_block(block):
    'Scan a block for interesting data.'
    for transaction in block['transactions']:
        if isinstance(transaction['trx'], dict):
            scan_transaction(transaction)


def start_block(block):
    'Called when starting to process a block.'
    print('starting block', block['block_num'])


def commit_block(block):
    'Called when finishing to process a block.'
    print('committing block', block['block_num'])
    scan_block(block)


def rollback(last_irr_block):
    'Called when rolling back.'
    print('rollback! LIB is', last_irr_block)


if __name__ == '__main__':
    demuxeos.Demux(
        client_node=NODE,
        start_block_fn=start_block,
        commit_block_fn=commit_block,
        rollback_fn=rollback
    ).process_blocks(
        requests.request("POST", "{}/v1/chain/get_info".format(NODE), headers={
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }).json()['last_irreversible_block_num'],
        include_effects=True, irreversible_only=True)
