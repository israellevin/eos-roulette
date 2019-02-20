#!/usr/bin/env python3
'Get actions from EOS blockchain in real time.'
import json
import sys

import demuxeos
import requests

NODE = 'https://api.eosnewyork.io'


def store_data(*args, **kwargs):
    'Store block data in a data store.'
    print('I would store this, but I am not yet implemented', args, kwargs)


def scan_action(action, block, transaction):
    'Scan an action for interesting data.'
    print(json.dumps((action, block, transaction), indent=4, sort_keys=True))


def start_block(block):
    'Called when starting to process a block.'
    print('starting block', block['block_num'])


def commit_block(block):
    'Called when finishing to process a block.'
    print('committing block', block['block_num'])
    global START_AT
    START_AT = block['block_num']


def rollback(last_irr_block):
    'Called when rolling back.'
    print('rollback! LIB is', last_irr_block)


def get_latest(irreversible_only=False):
    'Get the latest block number.'
    return requests.request("POST", "{}/v1/chain/get_info".format(NODE), headers={
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }).json()['last_irreversible_block_num' if irreversible_only else 'head_block_num']


def listen(account, name):
    '''
    Listen to a specific call on a specific account from a specific block
    onwards (default to latest irreversible block).
    '''
    demuxer = demuxeos.Demux(
        client_node=NODE,
        start_block_fn=start_block,
        commit_block_fn=commit_block,
        rollback_fn=rollback)
    global START_AT
    if not START_AT:
        START_AT = get_latest(True)
    demuxer.register_action(scan_action, account, name, is_effect=False)
    demuxer.register_action(scan_action, account, name, is_effect=True)
    # pylint: disable=broad-except
    try:
        print('starting to listen at', START_AT)
        demuxer.process_blocks(START_AT, include_effects=True, irreversible_only=True)
    except Exception as exception:
        print(exception)
        listen(account, name)


if __name__ == '__main__':
    try:
        START_AT = int(str(sys.argv[1]))
    except (IndexError, ValueError):
        START_AT = get_latest(True)
    listen('roulettespin', 'sendgain')
