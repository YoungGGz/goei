#!/bin/bash
# 사용: ./ev.sh 'JS 코드 (C, t, page 사용)'  또는  ./ev.sh -s steps/xx.mjs [arg-json]
if [ "$1" = "-s" ]; then curl -s -X POST localhost:7133/step -d "{\"file\":\"$2\",\"arg\":${3:-null}}"; else node -e 'process.stdout.write(JSON.stringify({code:process.argv[1]}))' "$1" | curl -s -X POST localhost:7133/eval --data-binary @-; fi
