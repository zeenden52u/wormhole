#!/bin/sh -f

while [[ "$(curl -s -o /dev/null  -H 'Content-Type: application/json' -X POST --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":67}' -w ''%{http_code}'' $1)" != "200" ]]; do sleep 5; done
