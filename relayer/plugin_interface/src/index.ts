import { Metric } from "prom-client";
import * as ethers from "ethers";
import * as solana from "@solana/web3.js";
import { ChainId, EVMChainId } from "@certusone/wormhole-sdk";
import * as winston from "winston";
/*
 *  Config
 */

// todo: Should these really be in this package? Probably shouldn't since plugins shouldn't depend on all these

// subset of common env that plugins should have access to
export interface CommonPluginEnv {
  envType: EnvTypes;
}

export enum EnvTypes {
  MAINNET = "MAINNET",
  DEVNET = "DEVNET",
  TILT = "TILT",
  LOCALHOST = "LOCALHOST",
  OTHER = "OTHER",
}

/*
 * Storage
 */

export interface WorkerAction {
  chainId: ChainId;             // Wormhole ChainID that given action is performed on
  id: ActionId;                 // Unique ID assigned to given action used to query from Redis 
  data: Object;                 // Action definition
  description?: string;         // Optional: string description
  depedencies?: ActionId[];     // Optional: array of Actions that are blockers
  delayTimestamp?: Date;        // Optional: time delay before performing the given action
}

export type ActionId = number; // todo: UUID

export type ActionQueueUpdate = {
  enqueueActions: WorkerAction[];     // FIFO array of actions
};

export type StagingArea = Object;     // Next action to be executed
/*
 * Wallets and Providers
 */

export type EVMWallet = ethers.Signer;
export type Wallet = EVMWallet | SolanaWallet | CosmWallet;

export interface WalletToolBox<T extends Wallet> extends Providers {
  wallet: T;
}

export type SolanaWallet = {
  conn: solana.Connection;
  payer: solana.Keypair;
};

export type CosmWallet = {};

export interface Providers {
  evm: { [id in EVMChainId]: ethers.providers.Provider };
  solana: solana.Connection;
  // todo: rest of supported chain providers
}

/*
 *  Plugin interfaces
 */
interface PluginCommonFields {
  pluginName: string;   // String identifier for plug-in
  pluginConfig: any;    // Configuration settings for plug-in
}
export interface Executor extends PluginCommonFields {
  demoteInProgress?: boolean;
  relayEvmAction?: (
    walletToolbox: WalletToolBox<EVMWallet>,
    action: WorkerAction,
    queuedActions: WorkerAction[]
  ) => Promise<ActionQueueUpdate>;
  relaySolanaAction?: (
    walletToolbox: WalletToolBox<SolanaWallet>,
    action: WorkerAction,
    queuedActions: WorkerAction[]
  ) => Promise<ActionQueueUpdate>;
  relayCosmAction?: (
    walletToolbox: WalletToolBox<CosmWallet>,
    action: WorkerAction,
    queuedActions: WorkerAction[]
  ) => Promise<ActionQueueUpdate>;
}

export interface Listener extends PluginCommonFields {
  shouldSpy: boolean;                           // Boolean toggle if relayer should connect to Guardian Network via non-validation guardiand node
  shouldRest: boolean;                          // Boolean toggle if relayer should connect to Guardian Network via REST API
  getFilters(): ContractFilter[];               // List of emitter addresses and emiiter chain ID to filter for
  consumeEvent(                                 // Function to be defined in plug-in that takes as input a VAA and outputs a list of actions
    vaa: Uint8Array,
    stagingArea: StagingArea
  ): Promise<{ actions: WorkerAction[]; nextStagingArea: StagingArea }>;
}

export type Plugin = Listener & Executor;
export interface PluginFactory {
  // validate untyped config and exception out if invalid
  create(
    config: CommonPluginEnv,
    pluginEnv: Record<string, any>,
    logger: winston.Logger
  ): Plugin;
  // plugin name
  pluginName: string;
}

export type ContractFilter = {
  emitterAddress: string;                  // Emitter contract address to filter for 
  chainId: ChainId;                        // Wormhole ChainID to filter for
};

/*
export abstract class DefaultPlugin implements Plugin {
  defaultConfigs: Map<EnvTypes | string, any> = new Map([]);
  env: any;
  name: string;
  shouldSpy: boolean;
  shouldRest: boolean;

  constructor(config: CommonEnvironment, overrides?: any) {
    const env = {
      ...this.defaultConfigs.get(config.envType),
      ...overrides,
    } as any | undefined;

    if (!env) {
      throw new Error("Plugin config must be defined");
    }
    this.env = env;
  }
  getFilters(): ContractFilter[] {
    throw new Error("Method not implemented.");
  }
  consumeEvent(
    vaa: Uint8Array,
    stagingArea: Object
  ): Promise<ActionQueueUpdate> {
    throw new Error("Method not implemented.");
  }

  abstract defineMetrics<T extends string>(): Metric<T>[];
}

*/
