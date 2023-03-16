#!/bin/bash -f

. env.sh

echo "sui client call --function publish_message_free --module wormhole --package $WORM_PACKAGE --gas-budget 20000 --args \"$WORM_DEPLOYER_CAPABILITY\" \"$WORM_STATE\" 400 [2]"
sui client call --function publish_message_free --module wormhole --package $WORM_PACKAGE --gas-budget 20000 --args \"$WORM_DEPLOYER_CAPABILITY\" \"$WORM_STATE\" 400 [2]
