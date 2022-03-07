import yargs from "yargs";

const {hideBin} = require('yargs/helpers')

import * as elliptic from "elliptic";
import * as ethers from "ethers";
import * as web3s from '@solana/web3.js';

import {fromUint8Array} from "js-base64";
import {LCDClient, MnemonicKey} from '@terra-money/terra.js';
import {MsgExecuteContract} from "@terra-money/terra.js";
import {PublicKey, TransactionInstruction, AccountMeta, Keypair, Connection} from "@solana/web3.js";
import {solidityKeccak256} from "ethers/lib/utils";

import {setDefaultWasm, importCoreWasm, importTokenWasm, ixFromRust, BridgeImplementation__factory} from '@certusone/wormhole-sdk'
setDefaultWasm("node")

const signAndEncodeVM = function (
    timestamp,
    nonce,
    emitterChainId,
    emitterAddress,
    sequence,
    data,
    signers,
    guardianSetIndex,
    consistencyLevel
) {
    const body = [
        ethers.utils.defaultAbiCoder.encode(["uint32"], [timestamp]).substring(2 + (64 - 8)),
        ethers.utils.defaultAbiCoder.encode(["uint32"], [nonce]).substring(2 + (64 - 8)),
        ethers.utils.defaultAbiCoder.encode(["uint16"], [emitterChainId]).substring(2 + (64 - 4)),
        ethers.utils.defaultAbiCoder.encode(["bytes32"], [emitterAddress]).substring(2),
        ethers.utils.defaultAbiCoder.encode(["uint64"], [sequence]).substring(2 + (64 - 16)),
        ethers.utils.defaultAbiCoder.encode(["uint8"], [consistencyLevel]).substring(2 + (64 - 2)),
        data.substr(2)
    ]

    const hash = solidityKeccak256(["bytes"], [solidityKeccak256(["bytes"], ["0x" + body.join("")])])

    let signatures = "";

    for (let i in signers) {
        const ec = new elliptic.ec("secp256k1");
        const key = ec.keyFromPrivate(signers[i]);
        const signature = key.sign(Buffer.from(hash.substr(2), "hex"), {canonical: true});

        const packSig = [
            ethers.utils.defaultAbiCoder.encode(["uint8"], [i]).substring(2 + (64 - 2)),
            zeroPadBytes(signature.r.toString(16), 32),
            zeroPadBytes(signature.s.toString(16), 32),
            ethers.utils.defaultAbiCoder.encode(["uint8"], [signature.recoveryParam]).substr(2 + (64 - 2)),
        ]

        signatures += packSig.join("")
    }

    const vm = [
        ethers.utils.defaultAbiCoder.encode(["uint8"], [1]).substring(2 + (64 - 2)),
        ethers.utils.defaultAbiCoder.encode(["uint32"], [guardianSetIndex]).substring(2 + (64 - 8)),
        ethers.utils.defaultAbiCoder.encode(["uint8"], [signers.length]).substring(2 + (64 - 2)),

        signatures,
        body.join("")
    ].join("");

    return vm
}

function zeroPadBytes(value, length) {
    while (value.length < 2 * length) {
        value = "0" + value;
    }
    return value;
}

yargs(hideBin(process.argv))
    .command('eth listen_for_shutdown_votes', 'listen for shutdown vote events', (yargs) => {
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
                default: "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
            })
    }, async (argv: any) => {
        const bridge = await importCoreWasm()

        let provider = new ethers.providers.JsonRpcProvider(argv.rpc)
        let signer = new ethers.Wallet(argv.key, provider)
        let t = new BridgeImplementation__factory(signer);
        let tb = t.attach(argv.token_bridge);

        console.log("Listening for shutdown vote events.");

        tb.on('ShutdownVoteCast', function(voter, votedToEnable, numVotesToDisable, enabledFlag, rawEvent) {
            console.log(new Date().toString() + ": ShutdownVoteCast:");
            console.log("   voter: [" + voter);
            console.log("   vote: " + votedToEnable);
            console.log("   numVotesToDisable: " + numVotesToDisable);
            console.log("   enabledFlag: " + enabledFlag);
            console.log("   sourceBridge: " + rawEvent.address);
            console.log("   txHash: " + rawEvent.transactionHash);
            console.log("");
        });

        tb.on('ShutdownStatusChanged', function(enabledFlag, numVotesToDisable, rawEvent) {
            console.log(new Date().toString() + ": ShutdownStatusChanged:");
            console.log("   enabledFlag: " + enabledFlag);
            console.log("   numVotesToDisable: " + numVotesToDisable);
            console.log("   sourceBridge: " + rawEvent.address);
            console.log("   txHash: " + rawEvent.transactionHash);
            console.log("");
        });
    })
    .argv;
