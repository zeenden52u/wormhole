import {
  ActionId,
  ActionQueueUpdate,
  CommonPluginEnv,
  ContractFilter,
  EVMWallet,
  Plugin,
  PluginFactory,
  Providers,
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

function create(
  commonConfig: CommonPluginEnv,
  pluginConfig: any,
  logger: Logger
): Plugin {
  return new AttestationPlugin(commonConfig, pluginConfig, logger);
}

interface AttestationPluginConfig {
  spyServiceFilters?: { chainId: ChainId; emitterAddress: string }[];
  shouldRest: boolean;
  shouldSpy: boolean;
  demoteInProgress: boolean;
}

interface CreateAttestation {
  mint: string;
  chainId: ChainId;
}

interface CreateWrappedAssetAction {
  attestationVaa: Uint8Array;
}

/*


createAttestation -> fetchVAA{ seq, emitter } -> craeateWrapped { vaa, chainId }

*/

function fetch(seq, emitter): WorkerAction;

async function attestationWorkflow(
  execute: (action: WorkerAction) => Promise<any>
  // ..
): Promise<void> {
  const craeatAttestation = {}; // ...
  const { seq, emitter } = await execute(craeatAttestation);
  const vaa = await execute(fetch(seq, emitter));

  await Promise.all(
    allTheChains.map(c => execute(createWrappedAssetAction(vaa, c)))
  );
}

async function xRaydiumWorkflow(
  execute: (action: WorkerAction) => Promise<any>
  //...
): Promise<void> {
  await attestationWorkflow(execute);
}

class AttestationPlugin implements Plugin {
  readonly shouldSpy: boolean;
  readonly shouldRest: boolean;
  static readonly pluginName: string = "AttestationPlugin";
  readonly pluginName = AttestationPlugin.pluginName;
  readonly pluginConfig: AttestationPluginConfig;
  readonly demoteInProgress: boolean;

  constructor(
    readonly config: CommonPluginEnv,
    env: Record<string, any>,
    readonly logger: Logger
  ) {
    console.log(`Config: ${JSON.stringify(config, undefined, 2)}`);
    console.log(`Plugin Env: ${JSON.stringify(env, undefined, 2)}`);

    this.pluginConfig = {
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

  async consumeEvent(
    vaa: Uint8Array,
    stagingArea: { counter?: number },
    providers: Providers,
    actionIdCreator: () => ActionId
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

const factory: PluginFactory = {
  create,
  pluginName: AttestationPlugin.pluginName,
};

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
