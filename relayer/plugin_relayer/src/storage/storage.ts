import { ChainId } from "@certusone/wormhole-sdk";
import { Plugin, StagingArea, WorkerAction, Workflow } from "plugin_interface";
import { ExecutorEnv } from "../config";

export interface PluginStorageFactory {
  getPluginStorage(plugin: Plugin): PluginStorage;
}

// Idea is we could have multiple implementations backed by different types of storage
// i.e. RedisStorage, PostgresStorage, MemoryStorage etc.
export interface Storage extends PluginStorageFactory {
  getNextAction(
    chainId: ChainId,
    plugins: Plugin[]
  ): Promise<{
    action: WorkerAction;
    queuedActions: WorkerAction[];
    pluginStorage: PluginStorage;
  } | null>;

  getNextWorkflow(
    plugins: Plugin[]
  ): Promise<{ workflow: Workflow; plugin: PluginStorage }>;

  handleStorageStartupConfig(
    plugins: Plugin[],
    config: ExecutorEnv
  ): Promise<void>;
}

export interface PluginStorage {
  readonly plugin: Plugin;
  demoteInProgress(this: PluginStorage, action: WorkerAction): Promise<void>;
  getNextAction(
    this: PluginStorage,
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
