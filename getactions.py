#!/usr/bin/env python3
'Get some EOS data.'
import requests

import db

TOKEN = (
    'eyJhbGciOiJLTVNFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1NTMzMzQ2NzIsImp0aSI6I'
    'jIwMzU1OWI0LTExODAtNDBmYi05MWU1LTlhMzBlNmI3MmUwYSIsImlhdCI6MTU1MDc0MjY3Miw'
    'iaXNzIjoiZGZ1c2UuaW8iLCJzdWIiOiJDaVFBNmNieWU0VlBCLzBkVEtJcjR0TElDOTZobCtMZm'
    'd6dkNQdk1uSm83T29uWGEwVFlTUEFBL0NMUnRZenl0RmJMbWlPYUdYekhvZG5jZ0pHdE9xVnM1'
    'UTBpRmwwREg5Y0RoQzlqVGQ4NHpQRndnTGY0b1dWTFdJQ09JZ2FiUTYwSzM1dz09IiwidGllci'
    'I6ImJldGEtdjEiLCJ2IjoxfQ.9KqNDQaCU-6apBFFqOewxXfJ-jJ7R4EPiQLjqH863ZUecHB80'
    'DhdMXe3llambDlpaowICTBHs5rA2xcCG8uxyQ')
BASE_URL = 'https://mainnet.eos.dfuse.io'


def process_action(action, txid, level):
    'Parse an action and store it in the db.'
    print("{}{}->{}.{}({})".format(
        level * '-',
        action['authorization'][0]['actor'],
        action['account'], action['name'], action['data']))
    db.action(
        txid, level, action['account'], action['name'], action['authorization'][0]['actor'], action['data'])


def process_traces(action, txid, level=0):
    'Recursively parse traces of an action.'
    process_action(action['act'], txid, level)
    if not action['inline_traces']:
        return
    for trace in action['inline_traces']:
        process_traces(trace, txid, level + 1)


def process_transaction(transaction):
    'Parse a transaction.'
    txid = transaction['lifecycle']['id']
    print("[{}]".format(txid))
    for action in transaction['lifecycle']['execution_trace']['action_traces']:
        process_traces(action, txid)


def populate_db(cursor=None):
    'Populate DB.'
    try:
        res = requests.get("{}/{}".format(BASE_URL, 'v0/search/transactions'), params={
            'token': TOKEN,
            'start_block': 43635900,
            'block_count': 100,
            'limit': 100,
            'q': 'receiver:roulettespin',
            'cursor': cursor
        }).json()

# pylint: disable=broad-except
    except Exception as exception:
        print('request error, retrying', exception)
        return populate_db(cursor)
# pylint: enable=broad-except

    try:
        for transaction in res['transactions']:
            process_transaction(transaction)
    except Exception as exception:
        print(res)
        raise
    if res['cursor']:
        print('cursor found, getting more', res['cursor'])
        populate_db(res['cursor'])
    return None


populate_db()
