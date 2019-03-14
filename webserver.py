#!/usr/bin/env python3
'Roulette server.'
import os

import flask
import flask_socketio

import db
import eos

STATIC_DIRS = ['www']
APP = flask.Flask('roulette')
APP.config['SECRET_KEY'] = os.urandom(24)
SOCKETIO = flask_socketio.SocketIO(APP, message_queue='redis://')


@SOCKETIO.on('heartbeat')
def heartbeat(user):
    'Get a heartbeat.'
    if user:
        db.heartbeat(user)


@SOCKETIO.on('get_balance')
def get_balance(user):
    'Get EOS balance of a user.'
    flask_socketio.emit('get_balance', eos.get_rows('eosio.token', 'accounts', user)['rows'][0]['balance'])


@SOCKETIO.on('get_spin')
def get_spin(min_maxbettime):
    'Get the currently running spin with the smallest maxbettime larget than min_maxbettime.'
    try:
        spin = eos.get_rows(
            'roulette', 'spins', 'roulette', index_position=3, key_type='i64',
            lower_bound=min_maxbettime, limit=1
        )['rows'][0]
    except IndexError:
        spin = None
    flask_socketio.emit('get_spin', spin)


@SOCKETIO.on('get_bets')
def get_bets(spin_hash):
    'Get the bets on a spin.'
    flask_socketio.emit('get_bets', [row for row in eos.get_rows(
        'roulette', 'bets', 'roulette', limit=999
    )['rows'] if row['hash'] == spin_hash])


@SOCKETIO.on('monitor_spin')
def monitor_spin(kwargs):
    'Get notified on spin events.'
    flask_socketio.join_room(kwargs['spin_hash'])
    flask_socketio.emit('bettor_joined', kwargs['user'], room=kwargs['spin_hash'])


@APP.route('/')
@APP.route('/<path:path>', methods=['GET', 'POST'])
# pylint: disable=unused-variable
def catch_all_handler(path='index.html'):
    """All undefined endpoints try to serve from the static directories."""
    for directory in STATIC_DIRS:
        if os.path.isfile(os.path.join(directory, path)):
            return flask.send_from_directory(directory, path)
    return flask.jsonify({'status': 403, 'error': "Forbidden path: {}".format(path)}), 403


if __name__ == '__main__':
    SOCKETIO.run(APP, host='0.0.0.0', debug=True)

