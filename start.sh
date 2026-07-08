#!/bin/bash

export DISPLAY=:0
export XAUTHORITY=/home/equilock/.Xauthority

cd /home/equilock/Desktop/equilock

lxterminal -e "bash -c 'node server.js; bash'" &
lxterminal -e "bash -c 'source venv/bin/activate && python main.py; bash'" &
lxterminal -e "bash -c 'ngrok http 5000; bash'" &

sleep 10

chromium --start-fullscreen http://localhost:5003
