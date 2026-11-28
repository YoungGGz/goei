#!/bin/bash
# 조종 서버 다시 띄우기 + 브라우저 열기. 사용: ./restart.sh '{"size":"pc"}'
cd "$(dirname "$0")"
ARG='{"size":"pc"}'; [ -n "$1" ] && ARG="$1"
curl -s -m 20 -X POST localhost:7133/close >/dev/null 2>&1
pkill -9 -f "node server.mjs --port 7133"; sleep 1
(setsid nohup node server.mjs --port 7133 > out/server.log 2>&1 &); sleep 2
curl -s -X POST localhost:7133/open -d "$ARG" | head -c 300; echo
