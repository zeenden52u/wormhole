"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadChainConfig = exports.getExecutorEnvironment = exports.getListenerEnvironment = exports.getCommonEnvironment = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
const logHelper_1 = require("./helpers/logHelper");
let loggingEnv = undefined;
const getCommonEnvironment = () => {
    if (loggingEnv) {
        return loggingEnv;
    }
    else {
        const env = createCommonEnvironment();
        loggingEnv = env;
        return loggingEnv;
    }
};
exports.getCommonEnvironment = getCommonEnvironment;
const errStr = (envVar) => `Missing required environment variable: ${envVar}`;
function parseOptionalEnvVar(envVar, parser) {
    const value = process.env[envVar];
    if (value) {
        return parser(value);
    }
    return undefined;
}
function parseEnvVar(envVar) {
    const value = process.env[envVar];
    if (!value) {
        throw new Error(errStr(envVar));
    }
    else {
        return value;
    }
}
function createCommonEnvironment() {
    return {
        logLevel: parseEnvVar("LOG_LEVEL"),
        promPort: parseInt(parseEnvVar("PROM_PORT")),
        logDir: parseOptionalEnvVar("LOG_DIR", x => x),
        readinessPort: parseOptionalEnvVar("READINESS_PORT", parseInt),
        redisHost: parseEnvVar("REDIS_HOST"),
        redisPort: parseInt(parseEnvVar("REDIS_PORT")),
        plugins: JSON.parse(parseEnvVar("PLUGINS")),
        envType: parseEnvVar("ENV_TYPE")
    };
}
let listenerEnv = undefined;
const getListenerEnvironment = () => {
    if (listenerEnv) {
        return listenerEnv;
    }
    else {
        const env = createListenerEnvironment();
        listenerEnv = env;
        return listenerEnv;
    }
};
exports.getListenerEnvironment = getListenerEnvironment;
const createListenerEnvironment = () => {
    let spyServiceHost;
    let spyServiceFilters = [];
    let restPort;
    let numSpyWorkers;
    let supportedTokens = [];
    const logger = (0, logHelper_1.getLogger)();
    if (!process.env.SPY_SERVICE_HOST) {
        throw new Error("Missing required environment variable: SPY_SERVICE_HOST");
    }
    else {
        spyServiceHost = process.env.SPY_SERVICE_HOST;
    }
    logger.info("Getting SPY_SERVICE_FILTERS...");
    if (!process.env.SPY_SERVICE_FILTERS) {
        throw new Error("Missing required environment variable: SPY_SERVICE_FILTERS");
    }
    else {
        const array = JSON.parse(process.env.SPY_SERVICE_FILTERS);
        // if (!array.foreach) {
        if (!array || !Array.isArray(array)) {
            throw new Error("Spy service filters is not an array.");
        }
        else {
            array.forEach((filter) => {
                if (filter.chainId && filter.emitterAddress) {
                    logger.info("nativeToHexString: " +
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
    logger.info("Getting REST_PORT...");
    if (!process.env.REST_PORT) {
        throw new Error("Missing required environment variable: REST_PORT");
    }
    else {
        restPort = parseInt(process.env.REST_PORT);
    }
    logger.info("Getting SPY_NUM_WORKERS...");
    if (!process.env.SPY_NUM_WORKERS) {
        throw new Error("Missing required environment variable: SPY_NUM_WORKERS");
    }
    else {
        numSpyWorkers = parseInt(process.env.SPY_NUM_WORKERS);
    }
    logger.info("Getting SUPPORTED_TOKENS...");
    if (!process.env.SUPPORTED_TOKENS) {
        throw new Error("Missing required environment variable: SUPPORTED_TOKENS");
    }
    else {
        // const array = JSON.parse(process.env.SUPPORTED_TOKENS);
        const array = eval(process.env.SUPPORTED_TOKENS);
        if (!array || !Array.isArray(array)) {
            throw new Error("SUPPORTED_TOKENS is not an array.");
        }
        else {
            array.forEach((token) => {
                if (token.chainId && token.address) {
                    supportedTokens.push({
                        chainId: token.chainId,
                        address: token.address,
                    });
                }
                else {
                    throw new Error("Invalid token record. " + token.toString());
                }
            });
        }
    }
    logger.info("Setting the listener backend...");
    return {
        spyServiceHost,
        spyServiceFilters,
        restPort,
        numSpyWorkers,
        supportedTokens,
    };
};
let executorEnv = undefined;
const getExecutorEnvironment = () => {
    if (executorEnv) {
        return executorEnv;
    }
    else {
        const env = createExecutorEnvironment();
        executorEnv = env;
        return executorEnv;
    }
};
exports.getExecutorEnvironment = getExecutorEnvironment;
const createExecutorEnvironment = () => {
    let supportedChains = [];
    let redisHost;
    let redisPort;
    let clearRedisOnInit;
    let demoteWorkingOnInit;
    let supportedTokens = [];
    const logger = (0, logHelper_1.getLogger)();
    if (!process.env.REDIS_HOST) {
        throw new Error("Missing required environment variable: REDIS_HOST");
    }
    else {
        redisHost = process.env.REDIS_HOST;
    }
    if (!process.env.REDIS_PORT) {
        throw new Error("Missing required environment variable: REDIS_PORT");
    }
    else {
        redisPort = parseInt(process.env.REDIS_PORT);
    }
    if (process.env.CLEAR_REDIS_ON_INIT === undefined) {
        throw new Error("Missing required environment variable: CLEAR_REDIS_ON_INIT");
    }
    else {
        if (process.env.CLEAR_REDIS_ON_INIT.toLowerCase() === "true") {
            clearRedisOnInit = true;
        }
        else {
            clearRedisOnInit = false;
        }
    }
    if (process.env.DEMOTE_WORKING_ON_INIT === undefined) {
        throw new Error("Missing required environment variable: DEMOTE_WORKING_ON_INIT");
    }
    else {
        if (process.env.DEMOTE_WORKING_ON_INIT.toLowerCase() === "true") {
            demoteWorkingOnInit = true;
        }
        else {
            demoteWorkingOnInit = false;
        }
    }
    supportedChains = loadChainConfig();
    if (!process.env.SUPPORTED_TOKENS) {
        throw new Error("Missing required environment variable: SUPPORTED_TOKENS");
    }
    else {
        // const array = JSON.parse(process.env.SUPPORTED_TOKENS);
        const array = eval(process.env.SUPPORTED_TOKENS);
        if (!array || !Array.isArray(array)) {
            throw new Error("SUPPORTED_TOKENS is not an array.");
        }
        else {
            array.forEach((token) => {
                if (token.chainId && token.address) {
                    supportedTokens.push({
                        chainId: token.chainId,
                        address: token.address,
                    });
                }
                else {
                    throw new Error("Invalid token record. " + token.toString());
                }
            });
        }
    }
    logger.info("Setting the relayer backend...");
    return {
        supportedChains,
        redisHost,
        redisPort,
        clearRedisOnInit,
        demoteWorkingOnInit,
        supportedTokens,
    };
};
//Polygon is not supported on local Tilt network atm.
function loadChainConfig() {
    if (!process.env.SUPPORTED_CHAINS) {
        throw new Error("Missing required environment variable: SUPPORTED_CHAINS");
    }
    if (!process.env.PRIVATE_KEYS) {
        throw new Error("Missing required environment variable: PRIVATE_KEYS");
    }
    const unformattedChains = JSON.parse(process.env.SUPPORTED_CHAINS);
    const unformattedPrivateKeys = JSON.parse(process.env.PRIVATE_KEYS);
    const supportedChains = [];
    if (!unformattedChains.forEach) {
        throw new Error("SUPPORTED_CHAINS arg was not an array.");
    }
    if (!unformattedPrivateKeys.forEach) {
        throw new Error("PRIVATE_KEYS arg was not an array.");
    }
    unformattedChains.forEach((element) => {
        if (!element.chainId) {
            throw new Error("Invalid chain config: " + element);
        }
        const privateKeyObj = unformattedPrivateKeys.find((x) => x.chainId === element.chainId);
        if (!privateKeyObj) {
            throw new Error("Failed to find private key object for configured chain ID: " +
                element.chainId);
        }
        if (element.chainId === wormhole_sdk_1.CHAIN_ID_SOLANA) {
            supportedChains.push(createSolanaChainConfig(element, privateKeyObj.privateKeys));
        }
        else if ((0, wormhole_sdk_1.isTerraChain)(element.chainId)) {
            supportedChains.push(createTerraChainConfig(element, privateKeyObj.privateKeys));
        }
        else {
            supportedChains.push(createEvmChainConfig(element, privateKeyObj.privateKeys));
        }
    });
    return supportedChains;
}
exports.loadChainConfig = loadChainConfig;
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
//# sourceMappingURL=configureEnv.js.map