import {
  ActionQueueUpdate,
  CommonPluginEnv,
  ContractFilter,
  CosmWallet,
  EVMWallet,
  Plugin,
  PluginFactory,
  SolanaWallet,
  WorkerAction,
} from "plugin_interface";

export function create(config: CommonPluginEnv, overrides?: any): Plugin {
  console.log("Creating da plugin...");
  return new DummyPlugin(config, overrides);
}

/*
 */

class DummyPlugin implements Plugin {
  shouldSpy: boolean;
  shouldRest: boolean;
  name: string;
  env: any;

  constructor(config: CommonPluginEnv, overrides: Object) {
    console.log(`Config: ${JSON.stringify(config, undefined, 2)}`);
    console.log(`Overrides: ${JSON.stringify(overrides, undefined, 2)}`);
    this.env = { shouldSpy: true, shouldRest: true, ...overrides };
    this.shouldRest = this.env.shouldRest;
    this.shouldSpy = this.env.shouldSpy;
    this.name = "DummyPlugin";
  }
  getFilters(): ContractFilter[] {
    return [{ chainId: 1, emitterAddress: "gotcha!!" }];
  }
  consumeEvent(
    vaa: Uint8Array,
    stagingArea: Object
  ): Promise<ActionQueueUpdate> {
    throw new Error("Method not implemented.");
  }
}

export default { create };
