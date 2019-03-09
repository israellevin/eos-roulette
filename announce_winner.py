#!/usr/bin/env python3
'Broadcast winning number messages via flask_socketio.'
import sys

import flask_socketio

NODEOS = 'http://localhost:8888'
SOCKETIO = flask_socketio.SocketIO(message_queue='redis://')


if __name__ == '__main__':
    SOCKETIO.emit('winning_number', int(sys.argv[2]), room=sys.argv[1])
