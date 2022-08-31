import { Metric } from "prom-client";
import * as ethers from "ethers";
import * as solana from "@solana/web3.js";
import { ChainId } from "@certusone/wormhole-sdk";

/*
 *  Config
 */

// todo: Should these really be in this package? Probably shouldn't since plugins shouldn't depend on all these

// subset of common env that plugins should have access to
export interface CommonPluginEnv {}

export enum EnvTypes {
  MAIN_NET = "MAIN_NET",
  DEV_NET = "DEV_NET",
}

/*
 * Storage
 */

export interface WorkerAction {
  chainId: ChainId;
  id: ActionId;
  data: Object;
  description?: string;
  depedencies?: ActionId[];
  delayTimestamp?: Date;
}

export type ActionId = "UUID"; // todo: import real type

export type ActionQueueUpdate = {
  enqueueActions: WorkerAction[];
};

export type StagingArea = Object;
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
  evm: ethers.providers.Provider;
  solana: solana.Connection;
  // todo: rest of supported chain providers
}

/*
 *  Plugin interfaces
 */
interface PluginCommonFields {
  name: string;
  env: any;
}
export interface Executor extends PluginCommonFields {
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
  shouldSpy: boolean;
  shouldRest: boolean;
  getFilters(): ContractFilter[];
  consumeEvent(
    vaa: Uint8Array,
    stagingArea: StagingArea
  ): Promise<{ actions: WorkerAction[]; nextStagingArea: StagingArea }>;
}

export type Plugin = Listener & Executor;
export interface PluginFactory {
  create(config: CommonPluginEnv, overrides?: any): Plugin;
}

export type ContractFilter = {
  emitterAddress: string;
  chainId: ChainId;
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
