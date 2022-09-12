import {
  ActionQueueUpdate,
  CommonPluginEnv,
  ContractFilter,
  CosmWallet,
  EVMWallet,
  Plugin,
  PluginFactory,
  SolanaWallet,
  StagingArea,
  WorkerAction,
} from "plugin_interface";
import { ChainId } from "@certusone/wormhole-sdk";
import { Logger, loggers } from "winston";
import { WalletToolBox } from "plugin_interface";

function create(
  commonConfig: CommonPluginEnv,
  pluginConfig: any,
  logger: Logger
): Plugin {
  console.log("Creating da plugin...");
  return new DummyPlugin(commonConfig, pluginConfig, logger);
}

interface Env {
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
  env: Env;
  config: CommonPluginEnv;
  demoteInProgress;

  constructor(config: CommonPluginEnv, env: Object, readonly logger: Logger) {
    console.log(`Config: ${JSON.stringify(config, undefined, 2)}`);
    console.log(`Plugin Env: ${JSON.stringify(env, undefined, 2)}`);

    this.config = config;
    this.env = env as Env;
    this.shouldRest = this.env.shouldRest;
    this.shouldSpy = this.env.shouldSpy;
    this.demoteInProgress = this.env.demoteInProgress;
  }

  getFilters(): ContractFilter[] {
    if (this.env.spyServiceFilters) {
      return this.env.spyServiceFilters;
    }
    return [{ chainId: 1, emitterAddress: "gotcha!!" }];
  }

  async relayEvmAction(
    walletToolbox: WalletToolBox<EVMWallet>,
    action: WorkerAction,
    queuedActions: WorkerAction[]
  ): Promise<ActionQueueUpdate> {
    this.logger.debug("Executing relayEVMAction");
    return {
      enqueueActions: [],
    };
  }

  async consumeEvent(
    vaa: Uint8Array,
    stagingArea: { counter?: number }
  ): Promise<{ actions: WorkerAction[]; nextStagingArea: StagingArea }> {
    console.log(`DummyPlugin consumed an event. Staging area: ${stagingArea}`);
    return {
      actions: [
        {
          chainId: 2,
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
