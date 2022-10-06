import { getExecutorEnv } from "../config";
import { getLogger, getScopedLogger } from "../helpers/logHelper";
import {
  Action,
  EVMWallet,
  Plugin,
  Providers,
  SolanaWallet,
  WalletToolBox,
  ActionExecutor,
  Workflow,
  WorkflowId,
  Wallet,
  ActionId,
} from "plugin_interface";
import * as solana from "@solana/web3.js";
import { sleep } from "../helpers/utils";
import { Storage } from "../storage/storage";
import * as wh from "@certusone/wormhole-sdk";
import * as ethers from "ethers";
import { ChainId, EVMChainId } from "@certusone/wormhole-sdk";
import { Queue } from "@datastructures-js/queue";
import { createWalletToolbox } from "./walletToolBox";

// todo: add to config
const DEFAULT_WORKER_RESTART_MS = 10 * 1000;
const DEFAULT_WORKER_INTERVAL_MS = 500;
const MAX_ACTIVE_WORKFLOWS = 10;
const SPAWN_WORKFLOW_INTERNAL = 500;

let actionIdCounter = 0;

export interface ActionWithCont<T, W extends Wallet> {
  action: Action<T, W>;
  id: ActionId;
  resolve: (t: T) => void;
  reject: (reason: any) => void;
}

async function spawnExecutor(
  storage: Storage,
  plugins: Plugin[],
  providers: Providers,
  workerInfoMap: Map<ChainId, WorkerInfo[]>
): Promise<void> {
  const executorEnv = getExecutorEnv();

  const actionQueues = spawnWalletWorkers(
    storage,
    plugins,
    providers,
    workerInfoMap
  );
  const activeWorkflows = new Map<WorkflowId, Workflow>();

  while (true) {
    try {
      if (activeWorkflows.size < MAX_ACTIVE_WORKFLOWS) {
        await spawnWorkflow(
          storage,
          plugins,
          providers,
          activeWorkflows,
          makeExecuteFunc(actionQueues)
        );
      }
    } catch (e) {
      getLogger().error("Ooops");
      getLogger().error(e);
    }
    await sleep(SPAWN_WORKFLOW_INTERNAL);
  }
}

function spawnWalletWorkers(
  storage: Storage,
  plugins: Plugin[],
  providers: Providers,
  workerInfoMap: Map<ChainId, WorkerInfo[]>
): Map<ChainId, Queue<ActionWithCont<any, any>>> {
  const actionQueues = new Map<ChainId, Queue<ActionWithCont<any, any>>>();
  // spawn worker for each wallet
  for (const [chain, workerInfos] of workerInfoMap.entries()) {
    const actionQueue = new Queue<ActionWithCont<any, any>>();
    actionQueues.set(chain, actionQueue);
    workerInfos.forEach(info =>
      spawnWalletWorker(actionQueue, providers, info)
    );
  }
  return actionQueues;
}

async function spawnWorkflow(
  storage: Storage,
  plugins: Plugin[],
  providers: Providers,
  activeWorkflows: Map<WorkflowId, Workflow>,
  execute: ActionExecutor
): Promise<void> {
  const { workflow, plugin } = await storage.getNextWorkflow(plugins);
  activeWorkflows.set(workflow.id, workflow);
  plugin.plugin
    .handleWorkflow(workflow, providers, execute)
    .then(() => activeWorkflows.delete(workflow.id));
}

function makeExecuteFunc(
  actionQueues: Map<ChainId, Queue<ActionWithCont<any, any>>>
): ActionExecutor {
  // push action onto actionQueue and have worker reject or resolve promise
  return action => {
    return new Promise((resolve, reject) => {
      actionQueues
        .get(action.chainId)
        ?.push({ action, resolve, reject, id: actionIdCounter++ });
    });
  };
}

export interface WorkerInfo {
  id: number;
  targetChainId: wh.ChainId;
  targetChainName: string;
  walletPrivateKey: string;
}

async function spawnWalletWorker(
  actionQueue: Queue<ActionWithCont<any, any>>,
  providers: Providers,
  workerInfo: WorkerInfo
): Promise<void> {
  const logger = getScopedLogger(
    [`${workerInfo.targetChainName}-${workerInfo.id}-worker`],
    getLogger()
  );
  logger.info(`Spawned`);
  const workerIntervalMS =
    getExecutorEnv().actionInterval || DEFAULT_WORKER_INTERVAL_MS;
  const walletToolBox = createWalletToolbox(
    providers,
    workerInfo.walletPrivateKey,
    workerInfo.targetChainId
  );
  // todo: add metrics
  while (true) {
    // always sleep between loop iterations
    await sleep(workerIntervalMS);

    try {
      if (actionQueue.isEmpty()) {
        logger.debug("No action found, sleeping...");
        continue;
      }
      const actionWithCont = actionQueue.dequeue();
      logger.info(
        `Relaying action ${actionWithCont.id} with plugin ${actionWithCont.action.pluginName}...`
      );

      try {
        await actionWithCont.action
          .f(walletToolBox, workerInfo.targetChainId)
          .then(actionWithCont.resolve);
        logger.info(`Action ${actionWithCont.id} completed`);
      } catch (e) {
        logger.error(e);
        logger.warn(
          "Unexpected error while executing chain action. Id: " +
            actionWithCont.id
        );
        actionWithCont.reject(e);
      }
    } catch (e) {
      logger.error(e);
      await sleep(DEFAULT_WORKER_RESTART_MS);
    }
  }
}