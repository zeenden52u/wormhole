import yargs from "yargs";

const {hideBin} = require('yargs/helpers')

import * as ethers from "ethers";
import * as web3s from '@solana/web3.js';

import {PublicKey, TransactionInstruction, AccountMeta, Keypair, Connection} from "@solana/web3.js";

import {setDefaultWasm, importCoreWasm, importTokenWasm, ixFromRust, BridgeImplementation__factory} from '@certusone/wormhole-sdk'
setDefaultWasm("node")

yargs(hideBin(process.argv))
    .command('cast_vote_on_evm [vote]', 'vote to enable / disable transaction processing', (yargs) => {
        return yargs
            .positional('vote', {
                describe: '"enable" or "disable", where disable will vote to disable transaction processing"',
                type: "string",
                required: true
            })
            .option('rpc', {
                alias: 'u',
                type: 'string',
                description: 'URL of the ETH RPC',
                default: "http://localhost:8545"
            })
            .option('bridge', {
                alias: 'b',
                type: 'string',
                description: 'Bridge address',
                default: "0x0290FB167208Af455bB137780163b7B7a9a10C16"
            })
            .option('key', {
                alias: 'k',
                type: 'string',
                description: 'Private key of the guardian',
                default: "0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0"
            })
            .option('nonce', {
                alias: 'n',
                type: 'string',
                description: 'Nonce to send with the vote for testing purposes, default is \"auto\", which means query for the correct value',
                default: "auto"
            })
    }, async (argv: any) => {
        let provider = new ethers.providers.JsonRpcProvider(argv.rpc)
        let signer = new ethers.Wallet(argv.key, provider)
        let t = new BridgeImplementation__factory(signer);
        let tb = t.attach(argv.bridge);

        let vote = argv.vote as string;
        let enable = false;
        if (vote === "enable") {
            enable = true;
        } else if (vote !== "disable") {
            throw new Error("[" + vote + "] is an invalid vote, must be \"enable\" or \"disable\"");
        }

        console.log("Casting vote to " + vote + " transfers.");
        console.log("Hash: " + (await tb.castShutdownVote(enable)).hash)
        console.log("Transaction processing is currently " + (await tb.enabledFlag() ? "enabled" : "disabled") + ", there are " + (await tb.numVotesToShutdown() + " votes to disable"));
    })
    .command('query_status_on_evm', 'query the current shutdown status', (yargs) => {
        return yargs
            .option('rpc', {
                alias: 'u',
                type: 'string',
                description: 'URL of the ETH RPC',
                default: "http://localhost:8545"
            })
            .option('bridge', {
                alias: 'b',
                type: 'string',
                description: 'Bridge address',
                default: "0x0290FB167208Af455bB137780163b7B7a9a10C16"
            })
            .option('key', {
                alias: 'k',
                type: 'string',
                description: 'Private key of the guardian',
                default: "0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0"
            })
    }, async (argv: any) => {

        let provider = new ethers.providers.JsonRpcProvider(argv.rpc)
        let signer = new ethers.Wallet(argv.key, provider)
        let t = new BridgeImplementation__factory(signer);
        let tb = t.attach(argv.bridge);

        let numVotesToShutdown = await tb.numVotesToShutdown();
        console.log("Current transfer status: " +
            ((await tb.enabledFlag()) ? "enabled" : "disabled") +
            ", numVotesToShutdown: " +
            numVotesToShutdown +
            ", requiredVotesToShutdown: " +
            (await tb.requiredVotesToShutdown())
        );

        if (numVotesToShutdown > 0) {
            let voters = await tb.currentVotesToShutdown();
            for (let voter of voters) {
                console.log("[" + voter + "] is voting to disable");
            }
        }
    })
    .command('listen_for_events_from_evm', 'listen for shutdown vote events', (yargs) => {
        return yargs
            .option('rpc', {
                alias: 'u',
                type: 'string',
                description: 'URL of the ETH RPC',
                default: "http://localhost:8545"
            })
            .option('token_bridge', {
                alias: 't',
                type: 'string',
                description: 'Token Bridge address',
                default: "0x0290FB167208Af455bB137780163b7B7a9a10C16"
            })
            .option('key', {
                alias: 'k',
                type: 'string',
                description: 'Private key of the wallet',
                default: "0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0"
            })
    }, async (argv: any) => {
        const bridge = await importCoreWasm()

        let provider = new ethers.providers.JsonRpcProvider(argv.rpc)
        let signer = new ethers.Wallet(argv.key, provider)
        let t = new BridgeImplementation__factory(signer);
        let tb = t.attach(argv.token_bridge);

        console.log("Listening for shutdown vote events.");

        tb.on('ShutdownVoteCast', function(voter, votedToEnable, numVotesToShutdown, enabledFlag, rawEvent) {
            console.log(new Date().toString() + ": ShutdownVoteCast:");
            console.log("   voter: [" + voter);
            console.log("   vote: " + votedToEnable);
            console.log("   numVotesToShutdown: " + numVotesToShutdown);
            console.log("   enabledFlag: " + enabledFlag);
            console.log("   sourceBridge: " + rawEvent.address);
            console.log("   txHash: " + rawEvent.transactionHash);
            console.log("");
        });

        tb.on('ShutdownStatusChanged', function(enabledFlag, numVotesToShutdown, rawEvent) {
            console.log(new Date().toString() + ": ShutdownStatusChanged:");
            console.log("   enabledFlag: " + enabledFlag);
            console.log("   numVotesToShutdown: " + numVotesToShutdown);
            console.log("   sourceBridge: " + rawEvent.address);
            console.log("   txHash: " + rawEvent.transactionHash);
            console.log("");
        });
    })
    .argv;
