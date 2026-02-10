#!/bin/bash
echo "Starting debug runner..." > /tmp/debug_runner.log
pwd >> /tmp/debug_runner.log
ls -la >> /tmp/debug_runner.log
python3 --version >> /tmp/debug_runner.log 2>&1
echo "Running search.py..." >> /tmp/debug_runner.log
python3 search.py "fitness" --design-system >> /tmp/debug_runner.log 2>&1
echo "Finished debug runner. Exit code: $?" >> /tmp/debug_runner.log
