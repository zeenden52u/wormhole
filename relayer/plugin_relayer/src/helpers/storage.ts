import { ChainId } from "@certusone/wormhole-sdk";
import {
  ActionId,
  ActionQueueUpdate,
  Plugin,
  StagingArea,
  WorkerAction,
} from "plugin_interface";
import { CommonEnv, ExecutorEnv } from "../configureEnv";
import RedisHelper from "./redisHelper";
import { RedisHelper as IRedisHelper } from "./redisHelper";

export interface PluginStorageFactory {
  getPluginStorage(plugin: Plugin): PluginStorage;
}

export async function createStorage(commonEnv: CommonEnv): Promise<Storage> {
  await RedisHelper.getClient();
  return new RedisStorage(RedisHelper);
}

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

export interface PluginStorage {
  readonly plugin: Plugin;
  getStagingArea(this: PluginStorage): Promise<StagingArea>;
  saveStagingArea(this: PluginStorage, update: StagingArea): Promise<void>;
  addActions(this: PluginStorage, actionsToAdd: WorkerAction[]): Promise<void>;
  applyActionUpdate(
    this: PluginStorage,
    update: ActionQueueUpdate,
    id: ActionId
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

// Idea is we could have multiple implementations backed by different types of storage
// i.e. RedisStorage, PostgresStorage, MemoryStorage etc.

export class RedisStorage implements Storage {
  constructor(readonly redis: IRedisHelper) {}

  getNextAction(
    chainId: ChainId,
    plugins: Plugin[]
  ): Promise<{
    action: WorkerAction;
    queuedActions: WorkerAction[];
    pluginStorage: PluginStorage;
  }> {
    throw new Error("Method not implemented.");
  }
  handleStorageStartupConfig(
    plugins: Plugin[],
    config: ExecutorEnv
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getPluginStorage(plugin: Plugin): PluginStorage {
    throw new Error("Method not implemented.");
  }
}

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
  addActions(this: PluginStorage, actionsToAdd: WorkerAction[]): Promise<void> {
    throw new Error("Method not implemented.");
  }
  applyActionUpdate(
    this: RedisPluginStorage,
    update: ActionQueueUpdate,
    id: ActionId
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  saveStagingArea(this: RedisPluginStorage, update: Object): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

const exports: PluginStorageFactory = { getPluginStorage };

export default exports;
