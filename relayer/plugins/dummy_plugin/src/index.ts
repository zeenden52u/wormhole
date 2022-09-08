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

export function create(config: CommonPluginEnv, overrides?: any): Plugin {
  console.log("Creating da plugin...");
  return new DummyPlugin(config, overrides);
}

class DummyPlugin implements Plugin {
  shouldSpy: boolean;
  shouldRest: boolean;
  static pluginName: string;
  pluginName = DummyPlugin.pluginName
  env: any;
  config: CommonPluginEnv

  constructor(config: CommonPluginEnv, overrides: Object) {
    console.log(`Config: ${JSON.stringify(config, undefined, 2)}`);
    console.log(`Overrides: ${JSON.stringify(overrides, undefined, 2)}`);
    this.config = config
    this.env = { shouldSpy: true, shouldRest: true, ...overrides };
    this.shouldRest = this.env.shouldRest;
    this.shouldSpy = this.env.shouldSpy;
    this.pluginName = "DummyPlugin";
  }

  getFilters(): ContractFilter[] {
    return [{ chainId: 1, emitterAddress: "gotcha!!" }];
  }

  async consumeEvent(
    vaa: Uint8Array,
    stagingArea: { counter?: number }
  ): Promise<{ actions: WorkerAction[]; nextStagingArea: StagingArea }> {
    console.log(`DummyPlugin consumed an event. Staging area: ${stagingArea}`);
    return {
      actions: [],
      nextStagingArea: {
        counter: stagingArea?.counter ? stagingArea.counter + 1 : 0,
      },
    };
  }
}

const factory: PluginFactory = { create, pluginName: DummyPlugin.pluginName }

export default factory;
