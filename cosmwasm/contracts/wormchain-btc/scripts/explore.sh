curl \
    --user user:password \
    --data-binary '{"method":"getbestblockhash","params":[],"id":1,"jsonrpc":"2.0"}' \
    -H 'content-type: text/plain;' \
    http://127.0.0.1:18334/

