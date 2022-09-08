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
import { Logger } from "winston";

function create(config: CommonPluginEnv, overrides?: any, logger: Logger): Plugin {
  console.log("Creating da plugin...");
  return new DummyPlugin(config, overrides, logger);
}

interface Env {
  hi?: string;
  spyServiceFilters?: { chainId: ChainId; emitterAddress: string }[];
  shouldRest: boolean;
  shouldSpy: boolean;
}

class DummyPlugin implements Plugin {
  shouldSpy: boolean;
  shouldRest: boolean;
  static readonly pluginName: string = "DummyPlugin";
  readonly pluginName = DummyPlugin.pluginName;
  env: Env;
  config: CommonPluginEnv;

  constructor(config: CommonPluginEnv, env: Object, logger: Logger) {
    console.log(`Config: ${JSON.stringify(config, undefined, 2)}`);
    console.log(`Plugin Env: ${JSON.stringify(env, undefined, 2)}`);

    this.config = config;
    this.env = env as Env;
    this.shouldRest = this.env.shouldRest;
    this.shouldSpy = this.env.shouldSpy;
  }

  getFilters(): ContractFilter[] {
    if (this.env.spyServiceFilters) {
      return this.env.spyServiceFilters;
    }
    return [{ chainId: 1, emitterAddress: "gotcha!!" }];
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
