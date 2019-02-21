#!/usr/bin/env python3
'Get some EOS data.'
import contextlib
import json
import sqlite3

import requests

# pylint: disable=line-too-long
TOKEN = 'eyJhbGciOiJLTVNFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1NTMzMzQ2NzIsImp0aSI6IjIwMzU1OWI0LTExODAtNDBmYi05MWU1LTlhMzBlNmI3MmUwYSIsImlhdCI6MTU1MDc0MjY3MiwiaXNzIjoiZGZ1c2UuaW8iLCJzdWIiOiJDaVFBNmNieWU0VlBCLzBkVEtJcjR0TElDOTZobCtMZmd6dkNQdk1uSm83T29uWGEwVFlTUEFBL0NMUnRZenl0RmJMbWlPYUdYekhvZG5jZ0pHdE9xVnM1UTBpRmwwREg5Y0RoQzlqVGQ4NHpQRndnTGY0b1dWTFdJQ09JZ2FiUTYwSzM1dz09IiwidGllciI6ImJldGEtdjEiLCJ2IjoxfQ.9KqNDQaCU-6apBFFqOewxXfJ-jJ7R4EPiQLjqH863ZUecHB80DhdMXe3llambDlpaowICTBHs5rA2xcCG8uxyQ'
# pylint: enable=line-too-long
BASE_URL = 'https://mainnet.eos.dfuse.io'


@contextlib.contextmanager
def sql_connection():
    """Context manager for querying the database."""
    try:
        connection = sqlite3.connect('eos.db')
        yield connection.cursor()
        connection.commit()
    except Exception as exception:
        print(exception)
        raise
    finally:
        if 'connection' in locals():
            connection.close()


def init_db():
    'Initialize DB.'
    with sql_connection() as sql:
        sql.execute('''
            CREATE TABLE IF NOT EXISTS actions
            (contract text, action text, caller text, kwargs text)''')


def populate_db():
    'Populate DB.'
    res = requests.get("{}/{}".format(BASE_URL, 'v0/search/transactions'), params={
        'token': TOKEN,
        'start_block': 0,
        'block_count': 99999999999,
        'limit': 100,
        'sort': 'desc',
        'q': 'receiver:roulettespin'
    }).json()

    print('cursor', res['cursor'])
    for transaction in res['transactions']:
        print('---')
        for action in transaction['lifecycle']['execution_trace']['action_traces']:
            action = action['act']
            print("{}@{}->{}.{}({})".format(
                action['authorization'][0]['actor'],
                action['authorization'][0]['permission'],
                action['account'], action['name'], action['data']))
            print('!')

            with sql_connection() as sql:
                sql.execute("INSERT INTO actions VALUES(?, ?, ?, ?)", (
                    action['account'], action['name'], action['authorization'][0]['actor'], json.dumps(action['data'])
                ))


# import websocket
# WS = websocket.create_connection("wss://mainnet.eos.dfuse.io/v1/stream?token={}".format(TOKEN))
# WS.send('''
# {
#   "type": "get_action_traces",
#   "listen": true,
#   "req_id": "stam",
#   "data": {
#     "accounts": "eosio.token",
#     "action_name": "transfer",
#     "with_inline_traces": true,
#     "with_dtrxops": true,
#     "with_ramops": true
#   }
# }
# ''')
# try:
#     while True:
#         p = json.loads(WS.recv())['data']
#         print(p)
# except Exception as exception:
#     print(exception)
# finally:
#     WS.close()
