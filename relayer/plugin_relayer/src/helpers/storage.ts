import { ChainId } from "@certusone/wormhole-sdk";
import {
  ActionQueueUpdate,
  Plugin,
  StagingArea,
  WorkerAction,
} from "plugin_interface";

interface StorageHandler {
  getStorageHandle(plugin: Plugin): StorageHandler;
  ensurePluginTables(): void;
  getNextAction(chainId: ChainId): WorkerAction;
  getStagingArea(): StagingArea;
  applyActionUpdate(update: ActionQueueUpdate): void;
  saveStagingArea(update: StagingArea): void;
}
