import {
  ActionQueueUpdate,
  CommonPluginEnv,
  ContractFilter,
  EVMWallet,
  Plugin,
  PluginFactory,
  StagingArea,
  WorkerAction,
} from "plugin_interface";
import {
  ChainId,
  importCoreWasm,
  setDefaultWasm,
} from "@certusone/wormhole-sdk";
import { Logger, loggers } from "winston";
import { WalletToolBox } from "plugin_interface";

// todo: do we need this in the plugin or just the relayer??
setDefaultWasm("node");

function create(
  commonConfig: CommonPluginEnv,
  pluginConfig: any,
  logger: Logger
): Plugin {
  console.log("Creating da plugin...");
  return new DummyPlugin(commonConfig, pluginConfig, logger);
}

interface DummyPluginConfig {
  hi?: string;
  spyServiceFilters?: { chainId: ChainId; emitterAddress: string }[];
  shouldRest: boolean;
  shouldSpy: boolean;
  demoteInProgress: boolean;
}

class DummyPlugin implements Plugin {
  shouldSpy: boolean;
  shouldRest: boolean;
  static readonly pluginName: string = "DummyPlugin";
  readonly pluginName = DummyPlugin.pluginName;
  readonly pluginConfig: DummyPluginConfig;
  readonly demoteInProgress;

  constructor(
    readonly config: CommonPluginEnv,
    env: Record<string, any>,
    readonly logger: Logger
  ) {
    console.log(`Config: ${JSON.stringify(config, undefined, 2)}`);
    console.log(`Plugin Env: ${JSON.stringify(env, undefined, 2)}`);

    this.pluginConfig = {
      hi: env.hi,
      spyServiceFilters:
        env.spyServiceFilters &&
        assertArray(env.spyServiceFilters, "spyServiceFilters"),
      shouldRest: assertBool(env.shouldRest, "shouldRest"),
      shouldSpy: assertBool(env.shouldSpy, "shouldSpy"),
      demoteInProgress:
        env.demoteInProgress &&
        assertBool(env.demoteInProgress, "demoteInProgress"),
    };
    this.shouldRest = this.pluginConfig.shouldRest;
    this.shouldSpy = this.pluginConfig.shouldSpy;
    this.demoteInProgress = this.pluginConfig.demoteInProgress;
  }

  getFilters(): ContractFilter[] {
    if (this.pluginConfig.spyServiceFilters) {
      return this.pluginConfig.spyServiceFilters;
    }
    this.logger.error("Contract filters not specified in config");
    throw new Error("Contract filters not specified in config");
  }

  async relayEvmAction(
    walletToolbox: WalletToolBox<EVMWallet>,
    action: WorkerAction,
    queuedActions: WorkerAction[]
  ): Promise<ActionQueueUpdate> {
    this.logger.info("Executing relayEVMAction");
    return {
      enqueueActions: [],
    };
  }

  // async relaySolanaAction(
  //   walletToolbox: WalletToolBox<SolanaWallet>,
  //   action: WorkerAction,
  //   queuedActions: WorkerAction[]
  // ): Promise<ActionQueueUpdate> {
  //   this.logger.info("Executing relaySolanaAction");
  //   return {
  //     enqueueActions: [],
  //   };
  // }

  async consumeEvent(
    vaa: Uint8Array,
    stagingArea: { counter?: number }
  ): Promise<{ actions: WorkerAction[]; nextStagingArea: StagingArea }> {
    this.logger.debug("Parsing VAA...");
    try {
      const { parse_vaa } = await importCoreWasm();
      var parsed = parse_vaa(vaa) as BaseVAA;
    } catch (e) {
      this.logger.error("Failed to parse vaa");
      throw e;
    }
    this.logger.info(
      `DummyPlugin consumed an event. Staging area: ${JSON.stringify(
        stagingArea
      )}`
    );
    this.logger.debug(`Parsed VAA: ${parsed}`);
    return {
      actions: [
        {
          chainId: parsed.emitter_chain,
          id: Math.floor(Math.random() * 1000),
          data: Math.random(),
        },
      ],
      nextStagingArea: {
        counter: stagingArea?.counter ? stagingArea.counter + 1 : 0,
      },
    };
  }
}

const factory: PluginFactory = { create, pluginName: DummyPlugin.pluginName };
console.log(factory.pluginName);

export default factory;

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

function assertBool(x: any, fieldName?: string): boolean {
  if (x !== false && x !== true) {
    const e = new Error(`Expected field to be boolean, found ${x}`) as any;
    e.fieldName = fieldName;
    throw e;
  }
  return x as boolean;
}

function nnull<T>(x: T | undefined | null, errMsg?: string): T {
  if (x === undefined || x === null) {
    throw new Error("Found unexpected undefined or null. " + errMsg);
  }
  return x;
}

export interface BaseVAA {
  version: number;
  guardianSetIndex: number;
  timestamp: number;
  nonce: number;
  emitter_chain: ChainId;
  emitter_address: Uint8Array; // 32 bytes
  sequence: number;
  consistency_level: number;
  payload: Uint8Array;
}
