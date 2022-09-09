"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStringEnum = exports.validateChainConfig = exports.validateExecutorEnv = exports.validateListenerEnv = exports.validateCommonEnv = void 0;
/*
 * Takes in untyped, resolved config objects and sets typed config objects
 */
const plugin_interface_1 = require("plugin_interface");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
function assertInt(x, fieldName) {
    if (!Number.isInteger(x)) {
        const e = new Error(`Expected field to be integer, found ${x}`);
        e.fieldName = fieldName;
        throw e;
    }
    return x;
}
function assertArray(x, fieldName) {
    if (!Array.isArray(x)) {
        const e = new Error(`Expected field to be array, found ${x}`);
        e.fieldName = fieldName;
        throw e;
    }
    return x;
}
function nnull(x, errMsg) {
    if (x === undefined || x === null) {
        throw new Error("Found unexpected undefined or null. " + errMsg);
    }
    return x;
}
function validateCommonEnv(raw) {
    return {
        logLevel: nnull(raw.logLevel, "logLevel"),
        promPort: assertInt(raw.promPort),
        logDir: raw.logDir,
        readinessPort: raw.readinessPort && assertInt(raw.readinessPort),
        redisHost: nnull(raw.redisHost),
        redisPort: parseInt(raw.restPort),
        pluginURIs: assertArray(raw.pluginURIs, "pluginURIs"),
        envType: validateStringEnum(plugin_interface_1.EnvTypes, raw.envType),
    };
}
exports.validateCommonEnv = validateCommonEnv;
function validateListenerEnv(raw) {
    return {
        spyServiceHost: raw.spyServiceHost,
        restPort: raw.restPort ? assertInt(raw.restPort, "restPort") : undefined,
        numSpyWorkers: raw.numSpyWorkers
            ? assertInt(raw.numSpyWorkers, "numSpyWorkers")
            : 1,
    };
}
exports.validateListenerEnv = validateListenerEnv;
function validateExecutorEnv(raw) {
    const supportedChains = validateChainConfig(raw.supportedChains, raw.privateKeys);
    return {
        supportedChains,
        redisHost: nnull(raw.redisHost, "redisHost"),
        redisPort: assertInt(raw.redisPort, "redisPort"),
    };
}
exports.validateExecutorEnv = validateExecutorEnv;
//Polygon is not supported on local Tilt network atm.
function validateChainConfig(supportedChainsRaw, privateKeysRaw) {
    if (!supportedChainsRaw || !Array.isArray(supportedChainsRaw)) {
        throw new Error("Missing required environment variable: supportedChains");
    }
    if (!privateKeysRaw || !Array.isArray(privateKeysRaw)) {
        throw new Error("Missing required environment variable: privateKeys");
    }
    const privateKeys = privateKeysRaw.map((k) => {
        if (!(k.chainId && k.privateKey && Number.isInteger(k.chainId))) {
            throw new Error("Invalid private key record from config");
        }
        return k;
    });
    supportedChainsRaw.forEach((element) => {
        if (!element.chainId) {
            throw new Error("Invalid chain config: " + element);
        }
        const privateKeyObj = privateKeys.find((x) => x.chainId === element.chainId);
        if (!privateKeyObj) {
            throw new Error("Failed to find private key object for configured chain ID: " +
                element.chainId);
        }
        if (element.chainId === wormhole_sdk_1.CHAIN_ID_SOLANA) {
            supportedChainsRaw.push(createSolanaChainConfig(element, privateKeyObj.privateKeys));
        }
        else if ((0, wormhole_sdk_1.isTerraChain)(element.chainId)) {
            supportedChainsRaw.push(createTerraChainConfig(element, privateKeyObj.privateKeys));
        }
        else {
            supportedChainsRaw.push(createEvmChainConfig(element, privateKeyObj.privateKeys));
        }
    });
    return supportedChainsRaw;
}
exports.validateChainConfig = validateChainConfig;
function createSolanaChainConfig(config, privateKeys) {
    const msg = (fieldName) => `Missing required field in chain config: ${fieldName}`;
    if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
        throw new Error("Ill formatted object received as private keys for Solana.");
    }
    const solanaPrivateKey = privateKeys.map((item) => {
        try {
            return Uint8Array.from(item);
        }
        catch (e) {
            throw new Error("Failed to coerce Solana private keys into a uint array. ENV JSON is possibly incorrect.");
        }
    });
    return {
        solanaPrivateKey,
        chainId: nnull(config.chainId, msg("chainId")),
        chainName: nnull(config.chainName, msg("chainName")),
        nativeCurrencySymbol: nnull(config.nativeCurrencySymbol, msg("nativeCurrencySymbol")),
        nodeUrl: nnull(config.nodeUrl, msg("nodeUrl")),
        tokenBridgeAddress: nnull(config.tokenBridgeAddress, msg("tokenBridgeAddress")),
        bridgeAddress: nnull(config.bridgeAddress, msg("bridgeAddress")),
        wrappedAsset: nnull(config.wrappedAsset, msg("wrappedAsset")),
    };
}
function createTerraChainConfig(config, privateKeys) {
    const msg = (fieldName) => `Missing required field in chain config: ${fieldName}`;
    let walletPrivateKey;
    if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
        throw new Error("Private keys for Terra are length zero or not an array.");
    }
    walletPrivateKey = privateKeys;
    return {
        walletPrivateKey,
        isTerraClassic: config.isTerraClassic || false,
        chainId: nnull(config.chainId, msg("chainId")),
        chainName: nnull(config.chainName, msg("chainName")),
        nativeCurrencySymbol: nnull(config.nativeCurrencySymbol, msg("nativeCurrencySymbol")),
        nodeUrl: nnull(config.nodeUrl, msg("nodeUrl")),
        tokenBridgeAddress: nnull(config.tokenBridgeAddress, msg("tokenBridgeAddress")),
        terraName: nnull(config.terraName, msg("terraName")),
        terraChainId: nnull(config.terraChainId, msg("terraChainId")),
        terraCoin: nnull(config.terraCoin, msg("terraCoin")),
        terraGasPriceUrl: nnull(config.terraGasPriceUrl, msg("terraGasPriceUrl")),
    };
}
function createEvmChainConfig(config, privateKeys) {
    if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
        throw new Error(`Private keys for chain id ${config.chainId} are length zero or not an array.`);
    }
    const msg = (fieldName) => `Missing required field in chain config: ${fieldName}`;
    return {
        walletPrivateKey: privateKeys,
        chainId: nnull(config.chainId, msg("chainId")),
        chainName: nnull(config.chainName, msg("chainName")),
        nativeCurrencySymbol: nnull(config.nativeCurrencySymbol, msg("nativeCurrencySymbol")),
        nodeUrl: nnull(config.nodeUrl, msg("nodeUrl")),
        tokenBridgeAddress: nnull(config.tokenBridgeAddress, msg("tokenBridgeAddress")),
        wrappedAsset: nnull(config.wrappedAsset, msg("wrappedAsset")),
    };
}
function validateStringEnum(enumObj, value) {
    if (Object.values(enumObj).includes(value)) {
        return value;
    }
    const e = new Error("Expected value to be member of enum");
    e.value = value;
    e.enumVariants = Object.values(enumObj);
    throw e;
}
exports.validateStringEnum = validateStringEnum;
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
//# sourceMappingURL=validateConfig.js.map