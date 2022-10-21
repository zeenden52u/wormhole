#!/bin/bash -f

set -x

cd /tmp

export NEAR_ENV=local
mkdir -p ~/.near
wget -q http://near:3031/validator_key.json -O ~/.near/validator_key.json
mkdir -p ~/.near-credentials/local
sed -e 's/"test.near"/"aurora.test.near"/' < ~/.near/validator_key.json > ~/.near-credentials/local/aurora.test.near.json

ts-node reset.ts
./node_modules/@auroraisnear/cli/lib/aurora.js --endpoint "http://near:3030"  install --chain 1313161556 --owner test.near aurora-engine/bin/aurora-local.wasm

cd aurora-relayer

#    kubectl exec -it aurora-0 -c aurora-node -- /bin/bash

until pg_isready -h localhost -p 5432; do echo waiting for database; sleep 2; done;

psql -v ON_ERROR_STOP=1 --host=localhost  --username aurora --dbname aurora < /tmp/aurora-relayer/.docker/docker-entrypoint-initdb.d/init.txt
node lib/index.js -v -d --database postgres://aurora:aurora@localhost/aurora --port 8545  --network local --endpoint "http://near:3030" 
