import { ChainId } from "@certusone/wormhole-sdk";
import {
  ActionId,
  ActionQueueUpdate,
  Plugin,
  StagingArea,
  WorkerAction,
} from "plugin_interface";
import { CommonEnv, ExecutorEnv } from "../configureEnv";
import * as RedisHelper from "./redisHelper";
import { RedisHelper as IRedisHelper } from "./redisHelper";

function sanitize(dirtyString: string): string {
  return dirtyString.replace("[^a-zA-z_0-9]*", "");
}

function stagingAreaKey(plugin: Plugin): string {
  return `staging-area/${sanitize(plugin.name)}`;
}

function actionPrefix(plugin: Plugin, chainId: number): string {
  return `actions/${sanitize(plugin.name)}/${chainId}/`;
}

function actionKey(
  plugin: Plugin,
  action: { chainId: number; id: ActionId }
): string {
  return `${actionPrefix(plugin, action.chainId)}${action.id}`;
}

export interface PluginStorageFactory {
  getPluginStorage(plugin: Plugin): PluginStorage;
}

export async function createStorage(commonEnv: CommonEnv): Promise<Storage> {
  await RedisHelper.ensureClient();
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
  getStagingArea(): Promise<StagingArea>;
  saveStagingArea(update: StagingArea): Promise<void>;
  addActions(actionsToAdd: WorkerAction[]): Promise<void>;
  applyActionUpdate(
    enqueuedActions: WorkerAction[],
    consumedAction: WorkerAction
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
  return new RedisPluginStorage(RedisHelper, plugin);
}

// Idea is we could have multiple implementations backed by different types of storage
// i.e. RedisStorage, PostgresStorage, MemoryStorage etc.

export class RedisStorage implements Storage {
  constructor(private readonly redis: IRedisHelper) {}

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

interface StorageAction {
  inProgress: boolean;
  action: WorkerAction;
}

class RedisPluginStorage implements PluginStorage {
  constructor(readonly redis: IRedisHelper, readonly plugin: Plugin) {
    this.redis = redis;
  }

  async getNextAction(
    this: RedisPluginStorage,
    chainId: ChainId
  ): Promise<WorkerAction | null> {
    const actions = await this.redis.getPrefix(
      actionPrefix(this.plugin, chainId)
    );
    for (let { key, value } of actions) {
      const storageAction = JSON.parse(value) as StorageAction;
      if (storageAction.inProgress) {
        continue;
      }
      if (
        storageAction.action.delayTimestamp &&
        new Date().getTime() < storageAction.action.delayTimestamp.getTime()
      ) {
        continue;
      }
      const setSuccessfully = await this.redis.compareAndSwap(
        key,
        value,
        JSON.stringify({ action: storageAction.action, inProgress: true })
      );
      if (setSuccessfully) {
        return storageAction.action;
      }
    }
    return null;
  }

  async getStagingArea(this: RedisPluginStorage): Promise<Object> {
    const key = stagingAreaKey(this.plugin);
    const raw = await this.redis.getItem(key);
    return JSON.parse(raw);
  }

  async addActions(
    this: RedisPluginStorage,
    actionsToAdd: WorkerAction[]
  ): Promise<void> {
    for (const action of actionsToAdd) {
      const key = actionKey(this.plugin, action);
      const storageAction: StorageAction = { action, inProgress: false };
      await this.redis.insertItem(key, JSON.stringify(storageAction));
    }
  }

  async applyActionUpdate(
    this: RedisPluginStorage,
    enqueuedActions: WorkerAction[],
    consumedAction: WorkerAction
  ): Promise<void> {
    await this.redis.removeItem(actionKey(this.plugin, consumedAction));
    await this.addActions(enqueuedActions);
  }

  async saveStagingArea(
    this: RedisPluginStorage,
    newStagingArea: Object
  ): Promise<void> {
    await this.redis.insertItem(
      stagingAreaKey(this.plugin),
      JSON.stringify(newStagingArea)
    );
  }
}

const toExport: PluginStorageFactory = { getPluginStorage };

export default toExport;
