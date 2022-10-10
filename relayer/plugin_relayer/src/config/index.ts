import { ChainId } from "@certusone/wormhole-sdk";
import { ChainConfigInfo, CommonPluginEnv, EnvTypes } from "plugin_interface";
import { loadUntypedEnvs, Mode } from "./loadConfig";
import {
  validateCommonEnv,
  validateExecutorEnv,
  validateListenerEnv,
} from "./validateConfig";

export type NodeURI = string;

export interface CommonEnv {
  logLevel: string;
  promPort?: number;
  readinessPort?: number;
  logDir?: string;
  redisHost: string;
  redisPort: number;
  pluginURIs: NodeURI[];
  envType: EnvTypes;
  mode: Mode;
  supportedChains: ChainConfigInfo[];
}
// assert CommonEnv is superset of CommonPluginEnv
let _x: CommonPluginEnv = {} as CommonEnv;

export type ListenerEnv = {
  spyServiceHost: string;
  restPort?: number;
  numSpyWorkers: number;
};

export type ExecutorEnv = {
  privateKeys: { [id in ChainId]: string[] };
  actionInterval?: number; // milliseconds between attempting to process actions
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
  rawListenerEnv,
  rawExecutorEnv,
}: {
  mode: Mode;
  rawCommonEnv: any;
  rawListenerEnv: any;
  rawExecutorEnv: any;
}) {
  console.log("Validating envs...");
  commonEnv = validateCommonEnv(rawCommonEnv);
  if (rawExecutorEnv) {
    executorEnv = validateExecutorEnv(rawExecutorEnv);
  }
  if (rawListenerEnv) {
    listenerEnv = validateListenerEnv(rawListenerEnv);
  }
  console.log("Validated envs");
}
