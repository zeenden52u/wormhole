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

export interface Workflow {
  id: ActionId;
  data: Object;
}

export interface Action<T, W extends Wallet> {
  pluginName: string,
  chainId: ChainId;
  f(walletToolBox: WalletToolBox<W>, chaidId: ChainId): Promise<T>;
}

export interface WorkerAction {
  chainId: ChainId; // Wormhole ChainID that given action is performed on
  id: ActionId; // Unique ID assigned to given action used to query from Redis
  data: Object; // Action definition
  description?: string; // Optional: string description
  depedencies?: ActionId[]; // Optional: array of Actions that are blockers
  delayTimestamp?: Date; // Optional: time delay before performing the given action
}

export type ActionId = number; // todo: UUID
export type WorkflowId = number; // todo: UUID

export type ActionQueueUpdate = {
  enqueueActions: WorkerAction[]; // FIFO array of actions
};

export type StagingArea = Object; // Next action to be executed
/*
 * Wallets and Providers
 */

export type EVMWallet = ethers.Signer & { address: string };
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

export type ActionExecutor = <T, W extends Wallet>(action: Action<T, W>) => Promise<T>;

/*
 *  Plugin interfaces
 */
interface PluginCommonFields {
  pluginName: string; // String identifier for plug-in
  pluginConfig: any; // Configuration settings for plug-in
}
export interface Executor extends PluginCommonFields {
  demoteInProgress?: boolean;
  handleWorkflow(workflow: Workflow, providers: Providers, execute: ActionExecutor): Promise<void>;
}

export interface Listener extends PluginCommonFields {
  shouldSpy: boolean; // Boolean toggle if relayer should connect to Guardian Network via non-validation guardiand node
  shouldRest: boolean; // Boolean toggle if relayer should connect to Guardian Network via REST API
  getFilters(): ContractFilter[]; // List of emitter addresses and emiiter chain ID to filter for
  consumeEvent( // Function to be defined in plug-in that takes as input a VAA and outputs a list of actions
    vaa: Uint8Array,
    stagingArea: StagingArea,
    providers: Providers
  ): Promise<{ workflowData: Object; nextStagingArea: StagingArea }>;
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
  emitterAddress: string; // Emitter contract address to filter for
  chainId: ChainId; // Wormhole ChainID to filter for
};
