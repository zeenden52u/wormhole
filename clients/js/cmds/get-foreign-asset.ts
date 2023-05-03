import yargs from "yargs";
import {
  ChainName,
  CHAINS,
  CONTRACTS,
  assertChain,
  isEVMChain,
  isTerraChain,
} from "@certusone/wormhole-sdk/lib/cjs/utils/consts";
import { getEmitterAddress } from "../emitter";

exports.command =
  "get-foreign-asset <network> <chain> <module> <origin-chain> <origin-address>";
exports.desc = "Look up the foreign asset on the specified chain / module";
exports.builder = (y: typeof yargs) => {
  return y
    .positional("network", {
      describe: "network",
      type: "string",
      choices: ["mainnet", "testnet", "devnet"],
    })
    .positional("chain", {
      describe: "Chain to query",
      type: "string",
      choices: Object.keys(CHAINS),
    })
    .positional("module", {
      describe: "Module to query (TokenBridge or NFTBridge)",
      type: "string",
      choices: ["NFTBridge", "TokenBridge"],
      required: true,
    })
    .positional("origin-chain", {
      describe: "Origin chain of the token to be looked up",
      type: "string",
      choices: Object.keys(CHAINS),
    })
    .positional("origin-address", {
      describe: "Address of the token on the origin chain",
      type: "string",
    });
};
exports.handler = async (argv) => {
  assertChain(argv["chain"]);
  const chain = argv.chain;
  const network = argv.network.toUpperCase();
  if (network !== "MAINNET" && network !== "TESTNET" && network !== "DEVNET") {
    throw Error(`Unknown network: ${network}`);
  }
  const module = argv.module;
  if (module !== "TokenBridge" && module !== "NFTBridge") {
    throw Error(`Module must be TokenBridge or NFTBridge`);
  }
  let results: object;
  if (chain === "solana") {
    // const solana = require("../solana");
    // results = await solana.query_registrations_solana(network, module);
  } else if (isEVMChain(chain)) {
    const evm = require("../evm");
    results = await evm.get_foreign_asset_on_evm(
      network,
      chain,
      module,
      argv["origin-chain"],
      argv["origin-address"]
    );
    // } else if (isTerraChain(chain) || chain === "xpla") {
    //   const terra = require("../terra");
    //   results = await terra.query_registrations_terra(network, chain, module);
    // } else if (chain === "injective") {
    //   const injective = require("../injective");
    //   await injective.query_registrations_injective(network, module);
    // } else if (chain === "sei") {
    //   const sei = require("../sei");
    //   results = await sei.query_registrations_sei(network, module);
    // } else {
    //   throw Error(`Command not supported for chain ${chain}`);
  }
};
