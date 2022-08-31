"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const configureEnv_1 = require("../configureEnv");
const logHelper_1 = require("../helpers/logHelper");
const solana = require("@solana/web3.js");
const utils_1 = require("../helpers/utils");
const wh = require("@certusone/wormhole-sdk");
const ethers = require("ethers");
const providers_1 = require("../utils/providers");
const WORKER_RESTART_MS = 10 * 1000;
const WORKER_INTERVAL_MS = 500;
const commonEnv = (0, configureEnv_1.getCommonEnvironment)();
let executorEnv;
/*
 * 1. Grab logger & commonEnv
 * 2. Instantiate executorEnv
 * 3. Demote in-progress actions and/or clear storage based off config
 * 5. For each wallet, spawn worker
 */
async function run(plugins, storage) {
    executorEnv = (0, configureEnv_1.getExecutorEnvironment)();
    const logger = (0, logHelper_1.getScopedLogger)(["executorHarness"], (0, logHelper_1.getLogger)());
    await storage.handleStorageStartupConfig(plugins, executorEnv);
    const providers = (0, providers_1.providersFromChainConfig)(executorEnv.supportedChains);
    logger.info("Spawning chain workers...");
    executorEnv.supportedChains.forEach((chain) => {
        let id = 0;
        const privatekeys = maybeConcat(chain.solanaPrivateKey, chain.walletPrivateKey);
        privatekeys.forEach((key) => {
            spawnWalletWorker(storage, plugins, providers, {
                id: id++,
                targetChainId: chain.chainId,
                targetChainName: chain.chainName,
                walletPrivateKey: key,
            });
        });
    });
}
exports.run = run;
/* Worker:
 *  - Writes wallet metrics
 *  - Gets next action
 *  - Plugin executes action
 *  - Appliess action updates
 */
async function spawnWalletWorker(storage, plugins, providers, workerInfo) {
    const logger = (0, logHelper_1.getScopedLogger)([`${workerInfo.targetChainName}-${workerInfo.id}-worker`], (0, logHelper_1.getLogger)());
    // todo: add metrics
    while (true) {
        try {
            const { pluginStorage, action, queuedActions } = await storage.getNextAction(workerInfo.targetChainId, plugins);
            logger.info(`Relaying action ${action.id} with plugin ${pluginStorage.plugin.name}...`);
            const update = await relayDispatcher(action, queuedActions, pluginStorage.plugin, workerInfo, providers, logger);
            pluginStorage.applyActionUpdate(update.enqueueActions, action);
            logger.info(`Action ${action.id} relayed`);
            await (0, utils_1.sleep)(WORKER_INTERVAL_MS);
        }
        catch (e) {
            logger.error(e);
            await (0, utils_1.sleep)(WORKER_RESTART_MS);
        }
    }
}
// dispatch action to plugin relay method by chainId
async function relayDispatcher(action, queuedActions, plugin, workerInfo, providers, logger) {
    const errTempplate = (chainName) => new Error(`${chainName} action scheduled for plugin that does not support ${chainName}`);
    if (wh.isEVMChain(workerInfo.targetChainId)) {
        const wallet = createEVMWalletToolBox(providers, workerInfo.walletPrivateKey);
        if (!plugin.relayEvmAction) {
            throw errTempplate(workerInfo.targetChainName);
        }
        return await plugin.relayEvmAction(wallet, action, queuedActions);
    }
    switch (workerInfo.targetChainId) {
        case wh.CHAIN_ID_SOLANA:
            const wallet = createSolanaWalletToolBox(providers, workerInfo.walletPrivateKey);
            if (!plugin.relaySolanaAction) {
                throw errTempplate(workerInfo.targetChainName);
            }
            return await plugin.relaySolanaAction(wallet, action, queuedActions);
        // case wh.CHAIN_ID_TERRA:
        // ...
    }
    throw new Error(`Spawned worker for unknown chainId ${workerInfo.targetChainId} with name ${workerInfo.targetChainName}`);
}
function createEVMWalletToolBox(providers, privateKey) {
    return {
        ...providers,
        wallet: new ethers.Wallet(privateKey, providers.evm),
    };
}
function createSolanaWalletToolBox(providers, privateKey) {
    return {
        ...providers,
        wallet: {
            conn: providers.solana,
            payer: solana.Keypair.fromSecretKey(privateKey),
        },
    };
}
function maybeConcat(...arrs) {
    return arrs.flatMap((arr) => (arr ? arr : []));
}
//# sourceMappingURL=executorHarness.js.map