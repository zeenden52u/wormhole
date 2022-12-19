
#!/usr/bin/env bash
set -exu pipefail

echo "Starting wormchaind"
make run > wormchaind.out 2>&1 &
# give wormchain 2 seconds to startup
sleep 2

cleanup() {
    echo "cleaning up test container"
    # kill wormchain, any dependents of the process (just in case)
    pkill -f "./build/wormchaind start --home build --log_level=debug"
    pkill -P $$
    # remove wormchaind log file
    rm wormchaind.out
}

cleanup_and_exit_failure() {
    cleanup
    echo "exiting with failure code"
    exit 1
}

# run the deploy, and catch if it returns an error code
npm run deploy-and-test --prefix contracts/tools  || cleanup_and_exit_failure

# cleanup and return success
cleanup
