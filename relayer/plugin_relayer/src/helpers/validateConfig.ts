/*
 * Takes in untyped, resolved config objects and sets typed config objects
 */
import { EnvTypes } from "plugin_interface";
import {
  ChainId,
  CHAIN_ID_SOLANA,
  isTerraChain,
  nativeToHexString,
} from "@certusone/wormhole-sdk";
import { Mode } from "./loadConfig";

export type NodeURI = string;

export type CommonEnv = {
  logLevel: string;
  promPort: number;
  readinessPort?: number;
  logDir?: string;
  redisHost: string;
  redisPort: number;
  pluginURIs: NodeURI[];
  envType: EnvTypes;
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
let executorEnv: ExecutorEnv | undefined = undefined;
let commonEnv: CommonEnv | undefined = undefined;
let listenerEnv: ListenerEnv | undefined = undefined;

type ConfigPrivateKey = {
  chainId: ChainId;
  privateKeys: string[];
};

export function getCommonEnv(): CommonEnv {
  if (!commonEnv) {
    throw new Error(
      "Tried to get CommonEnv but it does not exist. Has it been loaded yet?"
    );
  }
  return commonEnv;
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
  console.log("Validating envs...")
  commonEnv = validateCommonEnv(rawCommonEnv);
  if (mode === Mode.executor) {
    executorEnv = validateExecutorEnv(rawListenerOrExecutorEnv);
  } else if (mode === Mode.listener) {
    listenerEnv = validateListenerEnv(rawListenerOrExecutorEnv);
  } else {
    throw new Error("Unexpected mode: " + mode);
  }
  console.log("Validated envs")
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

function assertInt(x: any, fieldName?: string): number {
  if (!Number.isInteger(x)) {
    const e = new Error(`Expected field to be integer, found ${x}`) as any;
    e.fieldName = fieldName;
    throw e;
  }
  return x as number;
}

function assertArray<T>(x: any, fieldName?: string): T[] {
  if (!Array.isArray(x)) {
    const e = new Error(`Expected field to be array, found ${x}`) as any;
    e.fieldName = fieldName;
    throw e;
  }
  return x as T[];
}

function nnull<T>(x: T | undefined | null, errMsg?: string): T {
  if (x === undefined || x === null) {
    throw new Error("Found unexpected undefined or null. " + errMsg);
  }
  return x;
}

function validateCommonEnv(raw: any): CommonEnv {
  return {
    logLevel: nnull(raw.logLevel, "logLevel"),
    promPort: assertInt(raw.promPort),
    logDir: nnull(raw.logDir, "logDir"),
    readinessPort: raw.readinessPort && assertInt(raw.readinessPort),
    redisHost: nnull(raw.redisHost),
    redisPort: parseInt(raw.restPort),
    pluginURIs: assertArray(raw.pluginURIs, "pluginURIs"),
    envType: validateStringEnum<EnvTypes>(EnvTypes, raw.envTypes),
  };
}

function validateListenerEnv(raw: Keys<ListenerEnv>): ListenerEnv {
  let spyServiceHost: string;
  let spyServiceFilters: { chainId: ChainId; emitterAddress: string }[] = [];
  let restPort: number;
  let numSpyWorkers: number;
  let supportedTokens: { chainId: ChainId; address: string }[] = [];

  if (!raw.spyServiceHost) {
    throw new Error("Missing required environment variable: spyServiceHost");
  } else {
    spyServiceHost = raw.spyServiceHost;
  }

  console.info("Getting spyServiceFilters...");
  if (!raw.spyServiceFilters) {
    throw new Error("Missing required environment variable: spyServiceFilters");
  } else {
    const array = JSON.parse(raw.spyServiceFilters);
    // if (!array.foreach) {
    if (!array || !Array.isArray(array)) {
      throw new Error("Spy service filters is not an array.");
    } else {
      array.forEach((filter: any) => {
        if (filter.chainId && filter.emitterAddress) {
          console.info(
            "nativeToHexString: " +
              nativeToHexString(filter.emitterAddress, filter.chainId)
          );
          spyServiceFilters.push({
            chainId: filter.chainId as ChainId,
            emitterAddress: filter.emitterAddress,
          });
        } else {
          throw new Error("Invalid filter record. " + filter.toString());
        }
      });
    }
  }

  console.info("Getting restPort...");
  if (!raw.restPort) {
    throw new Error("Missing required environment variable: restPort");
  } else {
    restPort = parseInt(raw.restPort);
  }

  console.info("Getting numSpyWorkers...");
  if (!raw.numSpyWorkers) {
    throw new Error("Missing required environment variable: numSpyWorkers");
  } else {
    numSpyWorkers = parseInt(raw.numSpyWorkers);
  }

  console.info("Setting the listener backend...");

  return {
    spyServiceHost,
    spyServiceFilters,
    restPort,
    numSpyWorkers,
  };
}

function validateExecutorEnv(
  raw: Keys<ExecutorEnv & { privateKeys: ConfigPrivateKey[] }>
): ExecutorEnv {
  let supportedChains: ChainConfigInfo[] = [];
  let redisHost: string;
  let redisPort: number;

  if (!raw.redisHost) {
    throw new Error("Missing required environment variable: redisHost");
  } else {
    redisHost = raw.redisHost;
  }

  if (!raw.redisPort) {
    throw new Error("Missing required environment variable: redisPort");
  } else {
    redisPort = parseInt(raw.redisPort);
  }

  supportedChains = validateChainConfig(raw.supportedChains, raw.privateKeys);

  console.info("Setting the relayer backend...");

  return {
    supportedChains,
    redisHost,
    redisPort,
  };
}

//Polygon is not supported on local Tilt network atm.
export function validateChainConfig(
  supportedChainsRaw: any,
  privateKeysRaw: any
): ChainConfigInfo[] {
  if (!supportedChainsRaw || !Array.isArray(supportedChainsRaw)) {
    throw new Error("Missing required environment variable: supportedChains");
  }
  if (!privateKeysRaw || !Array.isArray(privateKeysRaw)) {
    throw new Error("Missing required environment variable: privateKeys");
  }
  const privateKeys: ConfigPrivateKey[] = privateKeysRaw.map((k: any) => {
    if (!(k.chainId && k.privateKey && Number.isInteger(k.chainId))) {
      throw new Error("Invalid private key record from config");
    }
    return k as ConfigPrivateKey;
  });

  const supportedChains: ChainConfigInfo[] = [];

  supportedChainsRaw.forEach((element: any) => {
    if (!element.chainId) {
      throw new Error("Invalid chain config: " + element);
    }

    const privateKeyObj = privateKeys.find(
      (x: ConfigPrivateKey) => x.chainId === element.chainId
    );
    if (!privateKeyObj) {
      throw new Error(
        "Failed to find private key object for configured chain ID: " +
          element.chainId
      );
    }

    if (element.chainId === CHAIN_ID_SOLANA) {
      supportedChainsRaw.push(
        createSolanaChainConfig(element, privateKeyObj.privateKeys)
      );
    } else if (isTerraChain(element.chainId)) {
      supportedChainsRaw.push(
        createTerraChainConfig(element, privateKeyObj.privateKeys)
      );
    } else {
      supportedChainsRaw.push(
        createEvmChainConfig(element, privateKeyObj.privateKeys)
      );
    }
  });

  return supportedChainsRaw;
}

function createSolanaChainConfig(
  config: any,
  privateKeys: any[]
): ChainConfigInfo {
  if (!config.chainId) {
    throw new Error("Missing required field in chain config: chainId");
  }
  if (!config.chainName) {
    throw new Error("Missing required field in chain config: chainName");
  }
  if (!config.nativeCurrencySymbol) {
    throw new Error(
      "Missing required field in chain config: nativeCurrencySymbol"
    );
  }
  if (!config.nodeUrl) {
    throw new Error("Missing required field in chain config: nodeUrl");
  }
  if (!config.tokenBridgeAddress) {
    throw new Error(
      "Missing required field in chain config: tokenBridgeAddress"
    );
  }
  if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
    throw new Error(
      "Ill formatted object received as private keys for Solana."
    );
  }
  if (!config.bridgeAddress) {
    throw new Error("Missing required field in chain config: bridgeAddress");
  }
  if (!config.wrappedAsset) {
    throw new Error("Missing required field in chain config: wrappedAsset");
  }

  const solanaPrivateKey = privateKeys.map((item: any) => {
    try {
      return Uint8Array.from(item);
    } catch (e) {
      throw new Error(
        "Failed to coerce Solana private keys into a uint array. ENV JSON is possibly incorrect."
      );
    }
  });

  return {
    solanaPrivateKey,
    chainId: config.chainId,
    chainName: config.chainName,
    nativeCurrencySymbol: config.nativeCurrencySymbol,
    nodeUrl: config.nodeUrl,
    tokenBridgeAddress: config.tokenBridgeAddress,
    bridgeAddress: config.bridgeAddress,
    wrappedAsset: config.wrappedAsset,
  };
}

function createTerraChainConfig(
  config: any,
  privateKeys: any[]
): ChainConfigInfo {
  let walletPrivateKey: string[];
  let isTerraClassic = false;

  if (!config.chainId) {
    throw new Error("Missing required field in chain config: chainId");
  }
  if (!config.chainName) {
    throw new Error("Missing required field in chain config: chainName");
  }
  if (!config.nativeCurrencySymbol) {
    throw new Error(
      "Missing required field in chain config: nativeCurrencySymbol"
    );
  }
  if (!config.nodeUrl) {
    throw new Error("Missing required field in chain config: nodeUrl");
  }
  if (!config.tokenBridgeAddress) {
    throw new Error(
      "Missing required field in chain config: tokenBridgeAddress"
    );
  }
  if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
    throw new Error("Private keys for Terra are length zero or not an array.");
  }
  if (!config.terraName) {
    throw new Error("Missing required field in chain config: terraName");
  }
  if (!config.terraChainId) {
    throw new Error("Missing required field in chain config: terraChainId");
  }
  if (!config.terraCoin) {
    throw new Error("Missing required field in chain config: terraCoin");
  }
  if (!config.terraGasPriceUrl) {
    throw new Error("Missing required field in chain config: terraGasPriceUrl");
  }

  walletPrivateKey = privateKeys;

  return {
    walletPrivateKey,
    isTerraClassic: config.isTerraClassic || false,
    chainId: config.chainId,
    chainName: config.chainName,
    nativeCurrencySymbol: config.nativeCurrencySymbol,
    nodeUrl: config.nodeUrl,
    tokenBridgeAddress: config.tokenBridgeAddress,
    terraName: config.terraName,
    terraChainId: config.terraChainId,
    terraCoin: config.terraCoin,
    terraGasPriceUrl: config.terraGasPriceUrl,
  };
}

function createEvmChainConfig(
  config: any,
  privateKeys: any[]
): ChainConfigInfo {
  if (!config.chainId) {
    throw new Error("Missing required field in chain config: chainId");
  }
  if (!config.chainName) {
    throw new Error("Missing required field in chain config: chainName");
  }
  if (!config.nativeCurrencySymbol) {
    throw new Error(
      "Missing required field in chain config: nativeCurrencySymbol"
    );
  }
  if (!config.nodeUrl) {
    throw new Error("Missing required field in chain config: nodeUrl");
  }
  if (!config.tokenBridgeAddress) {
    throw new Error(
      "Missing required field in chain config: tokenBridgeAddress"
    );
  }
  if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
    throw new Error(
      `Private keys for chain id ${config.chainId} are length zero or not an array.`
    );
  }

  if (!config.wrappedAsset) {
    throw new Error("Missing required field in chain config: wrappedAsset");
  }

  return {
    walletPrivateKey: privateKeys,
    chainId: config.chainId,
    chainName: config.chainName,
    nativeCurrencySymbol: config.nativeCurrencySymbol,
    nodeUrl: config.nodeUrl,
    tokenBridgeAddress: config.tokenBridgeAddress,
    wrappedAsset: config.wrappedAsset,
  };
}

type Keys<T> = { [k in keyof T]: any };
export function validateStringEnum<B>(
  enumObj: Object,
  value: string | undefined
): B {
  if (Object.values(enumObj).includes(value)) {
    return value as unknown as B;
  }
  const e = new Error("Expected value to be member of enum") as any;
  e.value = value;
  e.enumVariants = Object.values(enumObj);
  throw e;
}

/* We should do typesafe key validation, but this may require types specific to the on-disk config format, not the resolved config objects

const commonEnvKeys = createKeys<CommonEnv>({
  logDir: 1,
  logLevel: 1,
  readinessPort: 1,
  redisHost: 1,
  redisPort: 1,
  pluginURIs: 1,
  promPort: 1,
  envType: 1,
});
const listenerEnvKeys = createKeys<ListenerEnv>({
  spyServiceFilters: 1,
  spyServiceHost: 1,
  numSpyWorkers: 1,
  restPort: 1,
});
const executorEnvKeys = createKeys<ExecutorEnv>({
  redisHost: 1,
  redisPort: 1,
  supportedChains: 1,
});

function validateKeys<T>(keys: (keyof T)[], obj: Record<string, any>): Keys<T> {
  for (const key of keys) {
    if (!obj[key as string]) {
      throw new Error(`${String(key)} missing from object`);
    }
  }
  if (!Object.keys(obj).every(k => keys.includes(k as any))) {
    throw new Error(
      `Object includes keys missing from ${String(
        keys
      )}. Obj keys ${Object.keys(obj)}`
    );
  }
  return obj as { [k in keyof T]: any };
}

function createKeys<T>(keyRecord: Record<keyof T, any>): (keyof T)[] {
  return Object.keys(keyRecord) as any;
}
*/
