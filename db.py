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
            CREATE TABLE IF NOT EXISTS users (
                name TEXT PRIMARY KEY,
                last_seen INTEGER)''')


def heartbeat(user):
    'Upsert a user.'
    with sql_connection() as sql:
        sql.execute("""
            INSERT INTO users(name, last_seen) VALUES(?, ?)
            ON CONFLICT(name) DO UPDATE SET last_seen=?
        """, [user, ] + (2 * [int(time.time()), ]))
