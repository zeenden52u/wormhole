#!/bin/bash -f

set -x

cd /tmp

export NEAR_ENV=local

echo waiting for database
until pg_isready -h localhost -p 5432; do echo waiting for database; sleep 2; done;
echo waiting for relayer
while [[ "$(curl -s -o /dev/null  -H 'Content-Type: application/json' -X POST --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":67}' -w ''%{http_code}'' localhost:8545)" != "200" ]]; do sleep 5; done
echo starting indexer
cd /tmp/aurora-relayer/
util/indexer/indexer --config /tmp/tiltnet.yaml | node lib/indexer_backend.js --database postgres://aurora:aurora@localhost/aurora --network local --endpoint http://near:3030 --engine aurora
