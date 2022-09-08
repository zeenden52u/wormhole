"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStringEnum = exports.validateChainConfig = exports.getListenerEnv = exports.getExecutorEnv = exports.validateEnvs = exports.getCommonEnv = void 0;
/*
 * Takes in untyped, resolved config objects and sets typed config objects
 */
const plugin_interface_1 = require("plugin_interface");
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const loadConfig_1 = require("./loadConfig");
let loggingEnv = undefined;
let executorEnv = undefined;
let commonEnv = undefined;
let listenerEnv = undefined;
function getCommonEnv() {
    if (!commonEnv) {
        throw new Error("Tried to get CommonEnv but it does not exist. Has it been loaded yet?");
    }
    return commonEnv;
}
exports.getCommonEnv = getCommonEnv;
function validateEnvs({ mode, rawCommonEnv, rawListenerOrExecutorEnv, }) {
    commonEnv = validateCommonEnv(rawCommonEnv);
    if (mode === loadConfig_1.Mode.executor) {
        executorEnv = validateExecutorEnv(rawListenerOrExecutorEnv);
    }
    else if (mode === loadConfig_1.Mode.listener) {
        listenerEnv = validateListenerEnv(rawListenerOrExecutorEnv);
    }
    else {
        throw new Error("Unexpected mode: " + mode);
    }
}
exports.validateEnvs = validateEnvs;
function getExecutorEnv() {
    if (!executorEnv) {
        throw new Error("Tried to get ExecutorEnv but it does not exist. Has it been loaded yet?");
    }
    return executorEnv;
}
exports.getExecutorEnv = getExecutorEnv;
function getListenerEnv() {
    if (!listenerEnv) {
        throw new Error("Tried to get ListenerEnv but it does not exist. Has it been loaded yet?");
    }
    return listenerEnv;
}
exports.getListenerEnv = getListenerEnv;
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
        logDir: nnull(raw.logDir, "logDir"),
        readinessPort: raw.readinessPort && assertInt(raw.readinessPort),
        redisHost: nnull(raw.redisHost),
        redisPort: parseInt(raw.restPort),
        pluginURIs: assertArray(raw.pluginURIs, "pluginURIs"),
        envType: validateStringEnum(plugin_interface_1.EnvTypes, raw.envTypes),
    };
}
function validateListenerEnv(raw) {
    let spyServiceHost;
    let spyServiceFilters = [];
    let restPort;
    let numSpyWorkers;
    let supportedTokens = [];
    if (!raw.spyServiceHost) {
        throw new Error("Missing required environment variable: spyServiceHost");
    }
    else {
        spyServiceHost = raw.spyServiceHost;
    }
    console.info("Getting spyServiceFilters...");
    if (!raw.spyServiceFilters) {
        throw new Error("Missing required environment variable: spyServiceFilters");
    }
    else {
        const array = JSON.parse(raw.spyServiceFilters);
        // if (!array.foreach) {
        if (!array || !Array.isArray(array)) {
            throw new Error("Spy service filters is not an array.");
        }
        else {
            array.forEach((filter) => {
                if (filter.chainId && filter.emitterAddress) {
                    console.info("nativeToHexString: " +
                        (0, wormhole_sdk_1.nativeToHexString)(filter.emitterAddress, filter.chainId));
                    spyServiceFilters.push({
                        chainId: filter.chainId,
                        emitterAddress: filter.emitterAddress,
                    });
                }
                else {
                    throw new Error("Invalid filter record. " + filter.toString());
                }
            });
        }
    }
    console.info("Getting restPort...");
    if (!raw.restPort) {
        throw new Error("Missing required environment variable: restPort");
    }
    else {
        restPort = parseInt(raw.restPort);
    }
    console.info("Getting numSpyWorkers...");
    if (!raw.numSpyWorkers) {
        throw new Error("Missing required environment variable: numSpyWorkers");
    }
    else {
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
function validateExecutorEnv(raw) {
    let supportedChains = [];
    let redisHost;
    let redisPort;
    if (!raw.redisHost) {
        throw new Error("Missing required environment variable: redisHost");
    }
    else {
        redisHost = raw.redisHost;
    }
    if (!raw.redisPort) {
        throw new Error("Missing required environment variable: redisPort");
    }
    else {
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
    const supportedChains = [];
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
    if (!config.chainId) {
        throw new Error("Missing required field in chain config: chainId");
    }
    if (!config.chainName) {
        throw new Error("Missing required field in chain config: chainName");
    }
    if (!config.nativeCurrencySymbol) {
        throw new Error("Missing required field in chain config: nativeCurrencySymbol");
    }
    if (!config.nodeUrl) {
        throw new Error("Missing required field in chain config: nodeUrl");
    }
    if (!config.tokenBridgeAddress) {
        throw new Error("Missing required field in chain config: tokenBridgeAddress");
    }
    if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
        throw new Error("Ill formatted object received as private keys for Solana.");
    }
    if (!config.bridgeAddress) {
        throw new Error("Missing required field in chain config: bridgeAddress");
    }
    if (!config.wrappedAsset) {
        throw new Error("Missing required field in chain config: wrappedAsset");
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
        chainId: config.chainId,
        chainName: config.chainName,
        nativeCurrencySymbol: config.nativeCurrencySymbol,
        nodeUrl: config.nodeUrl,
        tokenBridgeAddress: config.tokenBridgeAddress,
        bridgeAddress: config.bridgeAddress,
        wrappedAsset: config.wrappedAsset,
    };
}
function createTerraChainConfig(config, privateKeys) {
    let walletPrivateKey;
    let isTerraClassic = false;
    if (!config.chainId) {
        throw new Error("Missing required field in chain config: chainId");
    }
    if (!config.chainName) {
        throw new Error("Missing required field in chain config: chainName");
    }
    if (!config.nativeCurrencySymbol) {
        throw new Error("Missing required field in chain config: nativeCurrencySymbol");
    }
    if (!config.nodeUrl) {
        throw new Error("Missing required field in chain config: nodeUrl");
    }
    if (!config.tokenBridgeAddress) {
        throw new Error("Missing required field in chain config: tokenBridgeAddress");
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
function createEvmChainConfig(config, privateKeys) {
    if (!config.chainId) {
        throw new Error("Missing required field in chain config: chainId");
    }
    if (!config.chainName) {
        throw new Error("Missing required field in chain config: chainName");
    }
    if (!config.nativeCurrencySymbol) {
        throw new Error("Missing required field in chain config: nativeCurrencySymbol");
    }
    if (!config.nodeUrl) {
        throw new Error("Missing required field in chain config: nodeUrl");
    }
    if (!config.tokenBridgeAddress) {
        throw new Error("Missing required field in chain config: tokenBridgeAddress");
    }
    if (!(privateKeys && privateKeys.length && privateKeys.forEach)) {
        throw new Error(`Private keys for chain id ${config.chainId} are length zero or not an array.`);
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