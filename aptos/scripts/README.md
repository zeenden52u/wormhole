
Install `aptos` CLI by running
```shell
cargo install --git https://github.com/aptos-labs/aptos-core.git aptos --branch devnet
```

Install `worm` CLI by running
```
wormhole/clients/js $ make install
```

## Development workflow

NOTE: this is in flux and likely will change often, so look back here every now
and then.

First start the local aptos validator by running

``` shell
worm start-validator aptos
```

Then build & deploy the contracts

``` shell
make -C .. build && ts-node deploy.ts
```

Next, initialise the core bridge

``` shell
ts-node init.ts
```

At this point you can send messages by running

``` shell
ts-node publish_wormhole_message.ts
```

### Upgrades

TODO(csongor): add VAA stuff

Make a change to the contract, then rebuild and run the upgrade script:

``` shell
make -C .. build && ts-node upgrade.ts
```
