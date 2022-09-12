import { getCommonEnv, getExecutorEnv, ExecutorEnv } from "../config";
import { getLogger, getScopedLogger, ScopedLogger } from "../helpers/logHelper";
import {
  ActionQueueUpdate,
  EVMWallet,
  Plugin,
  Providers,
  SolanaWallet,
  WalletToolBox,
  WorkerAction,
} from "plugin_interface";
import * as solana from "@solana/web3.js";
import { sleep } from "../helpers/utils";
import { getPluginStorage, Storage } from "../storage/storage";
import * as wh from "@certusone/wormhole-sdk";
import * as ethers from "ethers";
import { providersFromChainConfig } from "../utils/providers";
import {
  CHAIN_ID_SOLANA,
  EVMChainId,
  isEVMChain,
  isTerraChain,
} from "@certusone/wormhole-sdk";

const WORKER_RESTART_MS = 10 * 1000;
const WORKER_INTERVAL_MS = 500;
let executorEnv: ExecutorEnv | undefined;

/*
 * 1. Grab logger & commonEnv
 * 2. Instantiate executorEnv
 * 3. Demote in-progress actions and/or clear storage based off config
 * 5. For each wallet, spawn worker
 */
export async function run(plugins: Plugin[], storage: Storage) {
  executorEnv = getExecutorEnv();
  const logger = getScopedLogger(["executorHarness"], getLogger());

  await storage.handleStorageStartupConfig(plugins, executorEnv);
  const providers = providersFromChainConfig(executorEnv.supportedChains);

  logger.info("Spawning chain workers...");
  executorEnv.supportedChains.forEach(chain => {
    let id = 0;
    const privatekeys = maybeConcat<WalletPrivateKey>(
      chain.solanaPrivateKey,
      chain.walletPrivateKey
    );
    //TODO update for all ecosystems
    const filteredPlugins = plugins.filter(x => {
      return (
        (isEVMChain(chain.chainId) && x.relayEvmAction) ||
        (chain.chainId === CHAIN_ID_SOLANA && x.relaySolanaAction) ||
        (isTerraChain(chain.chainId) && x.relayCosmAction)
      );
    });
    privatekeys.forEach(key => {
      spawnWalletWorker(storage, filteredPlugins, providers, {
        id: id++,
        targetChainId: chain.chainId,
        targetChainName: chain.chainName,
        walletPrivateKey: key,
      });
    });
  });
}

/* Worker:
 *  - Writes wallet metrics
 *  - Gets next action
 *  - Plugin executes action
 *  - Appliess action updates
 */
async function spawnWalletWorker(
  storage: Storage,
  plugins: Plugin[],
  providers: Providers,
  workerInfo: WorkerInfo
): Promise<void> {
  const logger = getScopedLogger(
    [`${workerInfo.targetChainName}-${workerInfo.id}-worker`],
    getLogger()
  );
  logger.info(`Spawned`);
  // todo: add metrics
  while (true) {
    try {
      const maybeAction = await storage.getNextAction(
        workerInfo.targetChainId,
        plugins
      );
      if (!maybeAction) {
        logger.debug("No action found, sleeping...");
        await sleep(WORKER_INTERVAL_MS);
        continue;
      }
      const { pluginStorage, action, queuedActions } = maybeAction;
      logger.info(
        `Relaying action ${action.id} with plugin ${pluginStorage.plugin.pluginName}...`
      );
      try {
        const update = await relayDispatcher(
          action,
          queuedActions,
          pluginStorage.plugin,
          workerInfo,
          providers,
          logger
        );
        pluginStorage.applyActionUpdate(update.enqueueActions, action);
        logger.info(`Action ${action.id} relayed`);
        await sleep(WORKER_INTERVAL_MS);
      } catch (e) {
        logger.error(e);
        logger.warn(
          "Unexpected error while relaying, demoting action " + action.id
        );
        await pluginStorage.demoteInProgress(action);
        await sleep(WORKER_INTERVAL_MS);
      }
    } catch (e) {
      logger.error(e);
      await sleep(WORKER_RESTART_MS);
    }
  }
}

// dispatch action to plugin relay method by chainId
async function relayDispatcher(
  action: WorkerAction,
  queuedActions: WorkerAction[],
  plugin: Plugin,
  workerInfo: WorkerInfo,
  providers: Providers,
  logger: ScopedLogger
): Promise<ActionQueueUpdate> {
  const errTempplate = (chainName: string) =>
    new Error(
      `${chainName} action scheduled for plugin that does not support ${chainName}`
    );

  if (wh.isEVMChain(workerInfo.targetChainId)) {
    const wallet = createEVMWalletToolBox(
      providers,
      workerInfo.walletPrivateKey as string,
      workerInfo.targetChainId
    );
    if (!plugin.relayEvmAction) {
      throw errTempplate(workerInfo.targetChainName);
    }
    return await plugin.relayEvmAction(wallet, action, queuedActions);
  }
  switch (workerInfo.targetChainId) {
    case wh.CHAIN_ID_SOLANA:
      const wallet = createSolanaWalletToolBox(
        providers,
        workerInfo.walletPrivateKey as Uint8Array
      );
      if (!plugin.relaySolanaAction) {
        throw errTempplate(workerInfo.targetChainName);
      }
      return await plugin.relaySolanaAction(wallet, action, queuedActions);
    // case wh.CHAIN_ID_TERRA:
    // ...
  }
  throw new Error(
    `Spawned worker for unknown chainId ${workerInfo.targetChainId} with name ${workerInfo.targetChainName}`
  );
}

type WalletPrivateKey = string | Uint8Array;
interface WorkerInfo {
  id: number;
  targetChainId: wh.ChainId;
  targetChainName: string;
  walletPrivateKey: WalletPrivateKey;
}

function createEVMWalletToolBox(
  providers: Providers,
  privateKey: string,
  chainId: EVMChainId
): WalletToolBox<EVMWallet> {
  return {
    ...providers,
    wallet: new ethers.Wallet(privateKey, providers.evm[chainId]),
  };
}

function createSolanaWalletToolBox(
  providers: Providers,
  privateKey: Uint8Array
): WalletToolBox<SolanaWallet> {
  return {
    ...providers,
    wallet: {
      conn: providers.solana,
      payer: solana.Keypair.fromSecretKey(privateKey),
    },
  };
}

function maybeConcat<T>(...arrs: (T[] | undefined)[]): T[] {
  return arrs.flatMap(arr => (arr ? arr : []));
}
