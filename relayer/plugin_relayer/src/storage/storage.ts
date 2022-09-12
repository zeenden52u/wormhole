import { ChainId } from "@certusone/wormhole-sdk";
import {
  ActionId,
  ActionQueueUpdate,
  Plugin,
  StagingArea,
  WorkerAction,
} from "plugin_interface";
import { CommonEnv, ExecutorEnv } from "../config";
import { getLogger, getScopedLogger } from "../helpers/logHelper";
import * as RedisHelper from "./redisHelper";
import { RedisHelper as IRedisHelper } from "./redisHelper";

function sanitize(dirtyString: string): string {
  return dirtyString.replace("[^a-zA-z_0-9]*", "");
}

function stagingAreaKey(plugin: Plugin): string {
  return `staging-area/${sanitize(plugin.pluginName)}`;
}

function actionPrefix(plugin: Plugin, chainId: number): string {
  return `actions/${sanitize(plugin.pluginName)}/${chainId}/`;
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
  } | null>;

  handleStorageStartupConfig(
    plugins: Plugin[],
    config: ExecutorEnv
  ): Promise<void>;
}

export interface PluginStorage {
  readonly plugin: Plugin;
  demoteInProgress(this: PluginStorage, action: WorkerAction): Promise<void>;
  getNextAction(
    this: RedisPluginStorage,
    chainId: ChainId
  ): Promise<{
    action: WorkerAction;
    queuedActions: WorkerAction[];
  } | null>;
  getStagingArea(): Promise<StagingArea>;
  saveStagingArea(update: StagingArea): Promise<void>;
  addActions(actionsToAdd: WorkerAction[]): Promise<void>;
  applyActionUpdate(
    enqueuedActions: WorkerAction[],
    consumedAction: WorkerAction
  ): Promise<void>;
}

export function getPluginStorage(plugin: Plugin): PluginStorage {
  return new RedisPluginStorage(RedisHelper, plugin);
}

// Idea is we could have multiple implementations backed by different types of storage
// i.e. RedisStorage, PostgresStorage, MemoryStorage etc.

export class RedisStorage implements Storage {
  constructor(private readonly redis: IRedisHelper) {
    this.logger = getScopedLogger([`RedisGlobalStorage`], getLogger());
  }
  logger;

  async getNextAction(
    chainId: ChainId,
    plugins: Plugin[]
  ): Promise<{
    action: WorkerAction;
    queuedActions: WorkerAction[];
    pluginStorage: PluginStorage;
  } | null> {
    // todo: ensure one plugin doesn't hog worker
    this.logger.debug(
      "Entering global getNextAction, total plugins: " + plugins.length
    );
    for (const plugin of plugins) {
      const pluginStorage = this.getPluginStorage(plugin);
      const maybeAction = await pluginStorage.getNextAction(chainId);
      if (maybeAction) {
        return { ...maybeAction, pluginStorage };
      }
    }
    return null;
  }
  async handleStorageStartupConfig(
    plugins: Plugin[],
    config: ExecutorEnv
  ): Promise<void> {
    for (const plugin of plugins) {
      if (!plugin.demoteInProgress) {
        continue;
      }
      try {
        for (const chainId of config.supportedChains.map(x => x.chainId)) {
          const items = await this.redis.getPrefix(
            actionPrefix(plugin, chainId)
          );
          for (const { key, value } of items) {
            const storageAction = JSON.parse(value);
            if (storageAction.inProgress) {
              await this.getPluginStorage(plugin).demoteInProgress(
                storageAction.action
              );
            }
          }
        }
      } catch (e) {
        this.logger.info(
          "Encountered an error while demoting in progress items at startup."
        );
        this.logger.error(e);
      }
    }
  }
  getPluginStorage(plugin: Plugin): RedisPluginStorage {
    return new RedisPluginStorage(this.redis, plugin);
  }
}

interface StorageAction {
  inProgress: boolean;
  action: WorkerAction;
}

class RedisPluginStorage implements PluginStorage {
  constructor(readonly redis: IRedisHelper, readonly plugin: Plugin) {
    this.redis = redis;
    this.logger = getScopedLogger(
      [`RedisPluginStorage ${plugin.pluginName}`],
      getLogger()
    );
  }
  logger;

  async demoteInProgress(this: RedisPluginStorage, action: WorkerAction) {
    await this.redis.compareAndSwap(
      actionKey(this.plugin, action),
      JSON.stringify({ action, inProgress: true }),
      JSON.stringify({ action, inProgress: false })
    );
  }

  async getNextAction(
    this: RedisPluginStorage,
    chainId: ChainId
  ): Promise<{
    action: WorkerAction;
    queuedActions: WorkerAction[];
  } | null> {
    this.logger.debug("Entered getNextAction from Redis plugin storage");
    const actions = await this.redis.getPrefix(
      actionPrefix(this.plugin, chainId)
    );
    this.logger.debug("Found " + actions.length + " actions from redis");
    for (let { key, value } of actions) {
      const storageAction = JSON.parse(value) as StorageAction;
      if (storageAction.inProgress) {
        this.logger.debug("Skipped action due to inProgress " + key);
        continue;
      }
      if (
        storageAction.action.delayTimestamp &&
        new Date().getTime() < storageAction.action.delayTimestamp.getTime()
      ) {
        this.logger.debug(
          "Skipped action due to delayTime " +
            key +
            " " +
            storageAction.action.delayTimestamp.getTime()
        );
        continue;
      }
      const setSuccessfully = await this.redis.compareAndSwap(
        key,
        value,
        JSON.stringify({ action: storageAction.action, inProgress: true })
      );
      if (setSuccessfully) {
        return {
          action: storageAction.action,
          queuedActions: actions.map(
            ({ value }) => JSON.parse(value).action as WorkerAction
          ),
        };
      }
    }
    return null;
  }

  async getStagingArea(this: RedisPluginStorage): Promise<Object> {
    const key = stagingAreaKey(this.plugin);
    const raw = await this.redis.getItem(key);
    if (!raw) {
      this.logger.warn(
        `Missing staging area for plugin ${this.plugin.pluginName}. Returning empty object`
      );
      return {};
    }
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
    this.logger.debug("Applying action update: " + consumedAction.id);
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
