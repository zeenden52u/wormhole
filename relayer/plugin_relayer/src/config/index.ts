import { ChainId } from "@certusone/wormhole-sdk";
import { EnvTypes } from "plugin_interface";
import { loadUntypedEnvs, Mode } from "./loadConfig";
import {
  validateCommonEnv,
  validateExecutorEnv,
  validateListenerEnv,
} from "./validateConfig";

export type NodeURI = string;

export type CommonEnv = {
  logLevel: string;
  promPort?: number;
  readinessPort?: number;
  logDir?: string;
  redisHost: string;
  redisPort: number;
  pluginURIs: NodeURI[];
  envType: EnvTypes;
  mode: Mode
  supportedChains: ChainConfigInfo[];
};

export type ListenerEnv = {
  spyServiceHost: string;
  restPort?: number;
  numSpyWorkers: number;
};

export type ExecutorEnv = {
  privateKeys: {[id in ChainId]: string[]}
  actionInterval?: number // milliseconds between attempting to process actions
};

export type ChainConfigInfo = {
  chainId: ChainId;
  chainName: string;
  nativeCurrencySymbol: string;
  nodeUrl: string;
  tokenBridgeAddress: string;
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
let executorEnv: ExecutorEnv | undefined = undefined;
let commonEnv: CommonEnv | undefined = undefined;
let listenerEnv: ListenerEnv | undefined = undefined;

export function getCommonEnv(): CommonEnv {
  if (!commonEnv) {
    throw new Error(
      "Tried to get CommonEnv but it does not exist. Has it been loaded yet?"
    );
  }
  return commonEnv;
}

export function getExecutorEnv(): ExecutorEnv {
  if (!executorEnv) {
    throw new Error(
      "Tried to get ExecutorEnv but it does not exist. Has it been loaded yet?"
    );
  }
  return executorEnv;
}

export function getListenerEnv(): ListenerEnv {
  if (!listenerEnv) {
    throw new Error(
      "Tried to get ListenerEnv but it does not exist. Has it been loaded yet?"
    );
  }
  return listenerEnv;
}

export function loadAndValidateConfig(): Promise<void> {
  return loadUntypedEnvs().then(validateEnvs);
}

export function validateEnvs({
  mode,
  rawCommonEnv,
  rawListenerOrExecutorEnv,
}: {
  mode: Mode;
  rawCommonEnv: any;
  rawListenerOrExecutorEnv: any;
}) {
  console.log("Validating envs...");
  commonEnv = validateCommonEnv(rawCommonEnv);
  if (mode === Mode.EXECUTOR) {
    executorEnv = validateExecutorEnv(rawListenerOrExecutorEnv);
  } else if (mode === Mode.LISTENER) {
    listenerEnv = validateListenerEnv(rawListenerOrExecutorEnv);
  } else {
    throw new Error("Unexpected mode: " + mode);
  }
  console.log("Validated envs");
}
