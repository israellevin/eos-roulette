#!/usr/bin/env python3
'Roulette database manager.'
import contextlib
import sqlite3
import time


@contextlib.contextmanager
def sql_connection():
    """Context manager for querying the database."""
    try:
        connection = sqlite3.connect('roulette.db')
        yield connection.cursor()
        connection.commit()
    except Exception as exception:
        print('sqlite error', exception)
        raise
    finally:
        if 'connection' in locals():
            connection.close()


def init_db():
    'Initialize DB.'
    with sql_connection() as sql:
        sql.execute('''
            CREATE TABLE IF NOT EXISTS users(
                name TEXT PRIMARY KEY,
                last_seen INTEGER)''')
        sql.execute('''
            CREATE TABLE IF NOT EXISTS actions(
                block TEXT,
                transaction TEXT,
                action TEXT,
                level INTEGER,
                caller TEXT,
                kwargs TEXT)''')


def heartbeat(user):
    'Upsert a user.'
    with sql_connection() as sql:
        now = int(time.time())
        sql.execute("UPDATE users SET last_seen = ? WHERE name = ?", (now, user))
        if sql.rowcount != 1:
            sql.execute("INSERT INTO users(name, last_seen) VALUES(?, ?)", (user, now))


def action(txid, level, account, name, signer, data):
    'Insert an action.'
    with sql_connection() as sql:
        sql.execute("INSERT INTO actions VALUES(?, ?, ?, ?, ?, ?)", (
            txid, level, account, name, signer, json.dumps(data)))
