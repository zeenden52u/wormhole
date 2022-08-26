import {
  ChainId,
  CHAIN_ID_SOLANA,
  isTerraChain,
  nativeToHexString,
} from "@certusone/wormhole-sdk";
import { EnvTypes } from "plugin_interface";
import { getLogger } from "./helpers/logHelper";

export type CommonEnv = {
  logLevel: string;
  promPort: number;
  readinessPort?: number;
  logDir?: string;
  redisHost: string;
  redisPort: number;
  plugins: [
    {
      uri: string;
      overrides: { [key: string]: any };
    }
  ];
  envType: EnvTypes | string;
};

export type ListenerEnv = {
  spyServiceHost: string;
  spyServiceFilters: { chainId: ChainId; emitterAddress: string }[];
  restPort: number;
  numSpyWorkers: number;
  supportedTokens: { chainId: ChainId; address: string }[];
};

export type ExecutorEnv = {
  supportedChains: ChainConfigInfo[];
  redisHost: string;
  redisPort: number;
  clearRedisOnInit: boolean;
  demoteWorkingOnInit: boolean;
  supportedTokens: { chainId: ChainId; address: string }[];
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

export const getCommonEnvironment: () => CommonEnv = () => {
  if (loggingEnv) {
    return loggingEnv;
  } else {
    const env = createCommonEnvironment();
    loggingEnv = env;
    return loggingEnv;
  }
};

const errStr = (envVar) => `Missing required environment variable: ${envVar}`;
function parseOptionalEnvVar<T>(
  envVar: string,
  parser: (x: string) => T
): T | undefined {
  const value = process.env[envVar];
  if (value) {
    return parser(value);
  }
  return undefined;
}
function parseEnvVar(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(errStr(envVar));
  } else {
    return value;
  }
}

function createCommonEnvironment(): CommonEnv {
  return {
    logLevel: parseEnvVar("LOG_LEVEL"),
    promPort: parseInt(parseEnvVar("PROM_PORT")),
    logDir: parseOptionalEnvVar("LOG_DIR", x => x),
    readinessPort: parseOptionalEnvVar("READINESS_PORT", parseInt),
    redisHost: parseEnvVar("REDIS_HOST"),
    redisPort: parseInt(parseEnvVar("REDIS_PORT")),
    plugins: JSON.parse(parseEnvVar("PLUGINS")),
    envType: parseEnvVar("ENV_TYPE") as EnvTypes
  };
}


let listenerEnv: ListenerEnv | undefined = undefined;

export const getListenerEnvironment: () => ListenerEnv = () => {
  if (listenerEnv) {
    return listenerEnv;
  } else {
    const env = createListenerEnvironment();
    listenerEnv = env;
    return listenerEnv;
  }
};

const createListenerEnvironment: () => ListenerEnv = () => {
  let spyServiceHost: string;
  let spyServiceFilters: { chainId: ChainId; emitterAddress: string }[] = [];
  let restPort: number;
  let numSpyWorkers: number;
  let supportedTokens: { chainId: ChainId; address: string }[] = [];
  const logger = getLogger();

  if (!process.env.SPY_SERVICE_HOST) {
    throw new Error("Missing required environment variable: SPY_SERVICE_HOST");
  } else {
    spyServiceHost = process.env.SPY_SERVICE_HOST;
  }

  logger.info("Getting SPY_SERVICE_FILTERS...");
  if (!process.env.SPY_SERVICE_FILTERS) {
    throw new Error(
      "Missing required environment variable: SPY_SERVICE_FILTERS"
    );
  } else {
    const array = JSON.parse(process.env.SPY_SERVICE_FILTERS);
    // if (!array.foreach) {
    if (!array || !Array.isArray(array)) {
      throw new Error("Spy service filters is not an array.");
    } else {
      array.forEach((filter: any) => {
        if (filter.chainId && filter.emitterAddress) {
          logger.info(
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

  logger.info("Getting REST_PORT...");
  if (!process.env.REST_PORT) {
    throw new Error("Missing required environment variable: REST_PORT");
  } else {
    restPort = parseInt(process.env.REST_PORT);
  }

  logger.info("Getting SPY_NUM_WORKERS...");
  if (!process.env.SPY_NUM_WORKERS) {
    throw new Error("Missing required environment variable: SPY_NUM_WORKERS");
  } else {
    numSpyWorkers = parseInt(process.env.SPY_NUM_WORKERS);
  }

  logger.info("Getting SUPPORTED_TOKENS...");
  if (!process.env.SUPPORTED_TOKENS) {
    throw new Error("Missing required environment variable: SUPPORTED_TOKENS");
  } else {
    // const array = JSON.parse(process.env.SUPPORTED_TOKENS);
    const array = eval(process.env.SUPPORTED_TOKENS);
    if (!array || !Array.isArray(array)) {
      throw new Error("SUPPORTED_TOKENS is not an array.");
    } else {
      array.forEach((token: any) => {
        if (token.chainId && token.address) {
          supportedTokens.push({
            chainId: token.chainId,
            address: token.address,
          });
        } else {
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

let executorEnv: ExecutorEnv | undefined = undefined;

export const getExecutorEnvironment: () => ExecutorEnv = () => {
  if (executorEnv) {
    return executorEnv;
  } else {
    const env = createExecutorEnvironment();
    executorEnv = env;
    return executorEnv;
  }
};

const createExecutorEnvironment: () => ExecutorEnv = () => {
  let supportedChains: ChainConfigInfo[] = [];
  let redisHost: string;
  let redisPort: number;
  let clearRedisOnInit: boolean;
  let demoteWorkingOnInit: boolean;
  let supportedTokens: { chainId: ChainId; address: string }[] = [];
  const logger = getLogger();

  if (!process.env.REDIS_HOST) {
    throw new Error("Missing required environment variable: REDIS_HOST");
  } else {
    redisHost = process.env.REDIS_HOST;
  }

  if (!process.env.REDIS_PORT) {
    throw new Error("Missing required environment variable: REDIS_PORT");
  } else {
    redisPort = parseInt(process.env.REDIS_PORT);
  }

  if (process.env.CLEAR_REDIS_ON_INIT === undefined) {
    throw new Error(
      "Missing required environment variable: CLEAR_REDIS_ON_INIT"
    );
  } else {
    if (process.env.CLEAR_REDIS_ON_INIT.toLowerCase() === "true") {
      clearRedisOnInit = true;
    } else {
      clearRedisOnInit = false;
    }
  }

  if (process.env.DEMOTE_WORKING_ON_INIT === undefined) {
    throw new Error(
      "Missing required environment variable: DEMOTE_WORKING_ON_INIT"
    );
  } else {
    if (process.env.DEMOTE_WORKING_ON_INIT.toLowerCase() === "true") {
      demoteWorkingOnInit = true;
    } else {
      demoteWorkingOnInit = false;
    }
  }

  supportedChains = loadChainConfig();

  if (!process.env.SUPPORTED_TOKENS) {
    throw new Error("Missing required environment variable: SUPPORTED_TOKENS");
  } else {
    // const array = JSON.parse(process.env.SUPPORTED_TOKENS);
    const array = eval(process.env.SUPPORTED_TOKENS);
    if (!array || !Array.isArray(array)) {
      throw new Error("SUPPORTED_TOKENS is not an array.");
    } else {
      array.forEach((token: any) => {
        if (token.chainId && token.address) {
          supportedTokens.push({
            chainId: token.chainId,
            address: token.address,
          });
        } else {
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
export function loadChainConfig(): ChainConfigInfo[] {
  if (!process.env.SUPPORTED_CHAINS) {
    throw new Error("Missing required environment variable: SUPPORTED_CHAINS");
  }
  if (!process.env.PRIVATE_KEYS) {
    throw new Error("Missing required environment variable: PRIVATE_KEYS");
  }

  const unformattedChains = JSON.parse(process.env.SUPPORTED_CHAINS);
  const unformattedPrivateKeys = JSON.parse(process.env.PRIVATE_KEYS);
  const supportedChains: ChainConfigInfo[] = [];

  if (!unformattedChains.forEach) {
    throw new Error("SUPPORTED_CHAINS arg was not an array.");
  }
  if (!unformattedPrivateKeys.forEach) {
    throw new Error("PRIVATE_KEYS arg was not an array.");
  }

  unformattedChains.forEach((element: any) => {
    if (!element.chainId) {
      throw new Error("Invalid chain config: " + element);
    }

    const privateKeyObj = unformattedPrivateKeys.find(
      (x: any) => x.chainId === element.chainId
    );
    if (!privateKeyObj) {
      throw new Error(
        "Failed to find private key object for configured chain ID: " +
          element.chainId
      );
    }

    if (element.chainId === CHAIN_ID_SOLANA) {
      supportedChains.push(
        createSolanaChainConfig(element, privateKeyObj.privateKeys)
      );
    } else if (isTerraChain(element.chainId)) {
      supportedChains.push(
        createTerraChainConfig(element, privateKeyObj.privateKeys)
      );
    } else {
      supportedChains.push(
        createEvmChainConfig(element, privateKeyObj.privateKeys)
      );
    }
  });

  return supportedChains;
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
