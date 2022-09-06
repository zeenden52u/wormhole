/*
 * Takes in untyped, resolved config objects and outputs typed config objects
 */
import { EnvTypes } from "plugin_interface";
import { ChainId } from "@certusone/wormhole-sdk";

export function parseExecutorEnv(resolved: Record<string, any>): ExecutorEnv {
  return {} as any;
}

export function parseListenerEnv(resolved: Record<string, any>): ListenerEnv {
  return {} as any;
}

export function parseCommonEnv(resolved: Record<string, any>): CommonEnv {
  return {} as CommonEnv;
}

type NodeURI = string;

export type CommonEnv = {
  logLevel: string;
  promPort: number;
  readinessPort?: number;
  logDir?: string;
  redisHost: string;
  redisPort: number;
  plugins: NodeURI[];
  envType: EnvTypes | string;
};

export type ListenerEnv = {
  spyServiceHost: string;
  spyServiceFilters: { chainId: ChainId; emitterAddress: string }[];
  restPort: number;
  numSpyWorkers: number;
};

export type ExecutorEnv = {
  supportedChains: ChainConfigInfo[];
  redisHost: string;
  redisPort: number;
};

export type ChainConfigInfo = {
  chainId: ChainId;
  chainName: string;
  nativeCurrencySymbol: string;
  nodeUrl: string;
  tokenBridgeAddress: string;
  walletPrivateKey?: string[];
  solanaPrivateKey?: Uint8Array[];
  bridgeAddress?: string;
  terraName?: string;
  terraChainId?: string;
  terraCoin?: string;
  terraGasPriceUrl?: string;
  wrappedAsset?: string | null;
  isTerraClassic?: boolean;
};

export type SupportedToken = {
  chainId: ChainId;
  address: string;
};

let loggingEnv: CommonEnv | undefined = undefined;
