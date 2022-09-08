/*
 * Takes in untyped, resolved config objects and sets typed config objects
 */
import { EnvTypes } from "plugin_interface";
import {
  ChainId,
  CHAIN_ID_SOLANA,
  isTerraChain,
} from "@certusone/wormhole-sdk";
import { CommonEnv, ExecutorEnv, ListenerEnv, ChainConfigInfo } from ".";

type ConfigPrivateKey = {
  chainId: ChainId;
  privateKeys: string[];
};

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

export function validateCommonEnv(raw: any): CommonEnv {
  return {
    logLevel: nnull(raw.logLevel, "logLevel"),
    promPort: assertInt(raw.promPort),
    logDir: raw.logDir,
    readinessPort: raw.readinessPort && assertInt(raw.readinessPort),
    redisHost: nnull(raw.redisHost),
    redisPort: parseInt(raw.restPort),
    pluginURIs: assertArray(raw.pluginURIs, "pluginURIs"),
    envType: validateStringEnum<EnvTypes>(EnvTypes, raw.envType),
  };
}

export function validateListenerEnv(raw: Keys<ListenerEnv>): ListenerEnv {
  return {
    spyServiceHost: raw.spyServiceHost,
    restPort: raw.restPort ? assertInt(raw.restPort, "restPort") : undefined,
    numSpyWorkers: raw.numSpyWorkers
      ? assertInt(raw.numSpyWorkers, "numSpyWorkers")
      : 1,
  };
}

export function validateExecutorEnv(
  raw: Keys<ExecutorEnv & { privateKeys: ConfigPrivateKey[] }>
): ExecutorEnv {
  const supportedChains = validateChainConfig(
    raw.supportedChains,
    raw.privateKeys
  );
  return {
    supportedChains,
    redisHost: nnull(raw.redisHost, "redisHost"),
    redisPort: assertInt(raw.redisPort, "redisPort"),
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
  config: Keys<ChainConfigInfo>,
  privateKeys: any[]
): ChainConfigInfo {
  const msg = (fieldName: string) =>
    `Missing required field in chain config: ${fieldName}`;
  if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
    throw new Error(
      "Ill formatted object received as private keys for Solana."
    );
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
    chainId: nnull(config.chainId, msg("chainId")),
    chainName: nnull(config.chainName, msg("chainName")),
    nativeCurrencySymbol: nnull(
      config.nativeCurrencySymbol,
      msg("nativeCurrencySymbol")
    ),
    nodeUrl: nnull(config.nodeUrl, msg("nodeUrl")),
    tokenBridgeAddress: nnull(
      config.tokenBridgeAddress,
      msg("tokenBridgeAddress")
    ),
    bridgeAddress: nnull(config.bridgeAddress, msg("bridgeAddress")),
    wrappedAsset: nnull(config.wrappedAsset, msg("wrappedAsset")),
  };
}

function createTerraChainConfig(
  config: any,
  privateKeys: any[]
): ChainConfigInfo {
  const msg = (fieldName: string) =>
    `Missing required field in chain config: ${fieldName}`;
  let walletPrivateKey: string[];

  if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
    throw new Error("Private keys for Terra are length zero or not an array.");
  }

  walletPrivateKey = privateKeys;

  return {
    walletPrivateKey,
    isTerraClassic: config.isTerraClassic || false,
    chainId: nnull(config.chainId, msg("chainId")),
    chainName: nnull(config.chainName, msg("chainName")),
    nativeCurrencySymbol: nnull(
      config.nativeCurrencySymbol,
      msg("nativeCurrencySymbol")
    ),
    nodeUrl: nnull(config.nodeUrl, msg("nodeUrl")),
    tokenBridgeAddress: nnull(
      config.tokenBridgeAddress,
      msg("tokenBridgeAddress")
    ),
    terraName: nnull(config.terraName, msg("terraName")),
    terraChainId: nnull(config.terraChainId, msg("terraChainId")),
    terraCoin: nnull(config.terraCoin, msg("terraCoin")),
    terraGasPriceUrl: nnull(config.terraGasPriceUrl, msg("terraGasPriceUrl")),
  };
}

function createEvmChainConfig(
  config: any,
  privateKeys: any[]
): ChainConfigInfo {
  if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
    throw new Error(
      `Private keys for chain id ${config.chainId} are length zero or not an array.`
    );
  }

  const msg = (fieldName: string) =>
    `Missing required field in chain config: ${fieldName}`;
  return {
    walletPrivateKey: privateKeys,
    chainId: nnull(config.chainId, msg("chainId")),
    chainName: nnull(config.chainName, msg("chainName")),
    nativeCurrencySymbol: nnull(
      config.nativeCurrencySymbol,
      msg("nativeCurrencySymbol")
    ),
    nodeUrl: nnull(config.nodeUrl, msg("nodeUrl")),
    tokenBridgeAddress: nnull(
      config.tokenBridgeAddress,
      msg("tokenBridgeAddress")
    ),
    wrappedAsset: nnull(config.wrappedAsset, msg("wrappedAsset")),
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
