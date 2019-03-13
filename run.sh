#!/bin/bash
. ./venv/bin/activate
./webserver.py >> web.log 2>&1 &
watch ./spinner.sh
