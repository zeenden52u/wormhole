
aurora github

  https://github.com/aurora-is-near/aurora-engine

aurora relayer

  https://github.com/aurora-is-near/aurora-relayer.git

# getting into the aurora k8s node (if you need to crawl around)

   kubectl exec -it aurora-0 -c aurora-node -- /bin/bash
   kubectl exec -it aurora-0 -c aurora-indexer -- /bin/bash
   kubectl exec -it aurora-0 -c eth-deploy -- /bin/sh
     npm_config_network=aurora_devnet npm run migrate-network
   kubectl exec -it guardian-0 -c guardiand -- /bin/bash

relayer is ready

   while [[ "$(curl -s -o /dev/null  -H 'Content-Type: application/json' -X POST --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":67}' -w ''%{http_code}'' $1)" != "200" ]]; do sleep 5; done


