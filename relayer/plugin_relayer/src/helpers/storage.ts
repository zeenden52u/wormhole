import { ChainId } from "@certusone/wormhole-sdk";
import {
  ActionQueueUpdate,
  Plugin,
  StagingArea,
  WorkerAction,
} from "plugin_interface";
import { ExecutorEnv } from "../configureEnv";

export interface Storage extends PluginStorageFactory {
  getNextAction(
    chainId: ChainId,
    plugins: Plugin[]
  ): Promise<{
    action: WorkerAction;
    queuedActions: WorkerAction[];
    pluginStorage: PluginStorage;
  }>;

  handleStorageStartupConfig(
    plugins: Plugin[],
    config: ExecutorEnv
  ): Promise<void>;
}

export async function getNextAction(
  chainId: ChainId,
  plugins: Plugin[]
): Promise<{
  action: WorkerAction;
  pluginActions: WorkerAction[];
  plugin: PluginStorage;
}> {
  throw new Error("Unimplemented");
}

export function getPluginStorage(plugin: Plugin): PluginStorage {
  return new RedisPluginStorage(plugin);
}

export interface PluginStorageFactory {
  getPluginStorage(plugin: Plugin): PluginStorage;
}

export interface PluginStorage {
  readonly plugin: Plugin;
  getNextAction(this: PluginStorage, chainId: ChainId): Promise<WorkerAction>;
  getStagingArea(this: PluginStorage): Promise<StagingArea>;
  applyActionUpdate(
    this: PluginStorage,
    update: ActionQueueUpdate
  ): Promise<void>;
  saveStagingArea(this: PluginStorage, update: StagingArea): Promise<void>;
}

// Idea is we could have multiple implementations backed by different types of storage 
// i.e. RedisStorage, PostgresStorage, MemoryStorage etc. 

class RedisPluginStorage implements PluginStorage {
  constructor(readonly plugin: Plugin) {}

  getNextAction(
    this: RedisPluginStorage,
    chainId: ChainId
  ): Promise<WorkerAction> {
    throw new Error("Method not implemented.");
  }
  getStagingArea(this: RedisPluginStorage): Promise<Object> {
    throw new Error("Method not implemented.");
  }
  applyActionUpdate(
    this: RedisPluginStorage,
    update: ActionQueueUpdate
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  saveStagingArea(this: RedisPluginStorage, update: Object): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

const exports: PluginStorageFactory = { getPluginStorage };

export default exports;
