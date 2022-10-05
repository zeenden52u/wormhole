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
  chainId: ChainId;
  id: ActionId;
  data: Object;
  description?: string;
  dependencies?: ActionId[];
  delayTimestamp?: Date;
}

export type ActionId = number; // todo: UUID

export type ActionQueueUpdate = {
  enqueueActions: WorkerAction[];
};

export type StagingArea = Object;
/*
 * Wallets and Providers
 */

export type EVMWallet = ethers.Signer & {address: string};
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
  pluginName: string;
  pluginConfig: any;
  // plugins that must be loaded for this plugin to work
  dependentPluginNames: string[]
}
export interface Executor extends PluginCommonFields {
  demoteInProgress?: boolean;
  relayEvmAction?: (
    walletToolbox: WalletToolBox<EVMWallet>,
    action: WorkerAction,
    queuedActions: WorkerAction[],
    plugins: Map<string, Plugin>
  ) => Promise<ActionQueueUpdate>;
  relaySolanaAction?: (
    walletToolbox: WalletToolBox<SolanaWallet>,
    action: WorkerAction,
    queuedActions: WorkerAction[],
    plugins: Map<string, Plugin>
  ) => Promise<ActionQueueUpdate>;
  relayCosmAction?: (
    walletToolbox: WalletToolBox<CosmWallet>,
    action: WorkerAction,
    queuedActions: WorkerAction[],
    plugins: Map<string, Plugin>
  ) => Promise<ActionQueueUpdate>;
}

export interface Listener extends PluginCommonFields {
  shouldSpy: boolean;
  shouldRest: boolean;
  getFilters(): ContractFilter[];
  consumeEvent(
    vaa: Uint8Array,
    stagingArea: StagingArea,
    providers: Providers,
    actionIdCreator: () => ActionId,
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
  emitterAddress: string;
  chainId: ChainId;
};