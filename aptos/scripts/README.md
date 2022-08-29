
Install `aptos` CLI by running
```shell
cargo install --git https://github.com/aptos-labs/aptos-core.git aptos --branch devnet
```

Install `worm` CLI by running
```
wormhole/clients/js $ make install
```

1. bring up local net using `worm start-validator aptos`
2. run `ts-node deploy.ts`
4. run `init_wormhole.ts`
5. run `publish_wormhole_message.ts`
