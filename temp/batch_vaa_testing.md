### BatchVAA e2e testing

start tilt with a second EVM chain (BSC) and the flag to enable BatchVAA production from the guardian:

    tilt up -- --manual --evm2=True --guardiand_batch_VAA=True

once the EVM networks are upand the guardian is ready, run the `eth-integration.ts` tests

    # get deps, if needed
    npm ci --prefix sdk/js && npm run --prefix sdk/js build

    # run test
    npm run --prefix sdk/js test -- src/batch_vaa/__tests__/eth-integration.ts

### misc

send a transaction to devnet Ethereum that publishes multiple messages

    minikube kubectl -- exec -n wormhole eth-devnet-0 -c tests --  npx truffle exec scripts/send_batched_vaa.js

or send a transactino to devnet BSC that emits multiple messages

    minikube kubectl -- exec -n wormhole eth-devnet2-0 -c tests --  npx truffle exec scripts/send_batched_vaa.js

run ethereum/test/wormhole.js

    cd ethereum && npm run --prefix

run ethereum/forge-test/Messages.t.sol

    cd ethereum && forge test --match-contract TestMessages

run tests in VSCode's debugger, see [.vscode/launch.json](.vscode/launch.json)
