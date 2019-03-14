#!/bin/bash
. ./venv/bin/activate
./webserver.py >> web.log 2>&1 &
trap "kill $$" EXIT
watch ./spinner.sh
