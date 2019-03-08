#!/usr/bin/env python3
'Interface to EOS distributed tables.'
import json
import os

import requests

NODEOS = os.environ.get('ROULETTE_NODEOS', 'http://localhost:8888')


def get_rows(code, table, scope, **kwargs):
    'Call nodeos api.'
    return requests.post("{}/v1/chain/get_table_rows".format(NODEOS), headers={
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }, data=json.dumps(dict(kwargs, code=code, table=table, scope=scope, json=True))).json()
