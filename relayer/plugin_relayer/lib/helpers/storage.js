"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStorage = exports.getPluginStorage = exports.createStorage = void 0;
const ethers_1 = require("ethers");
const RedisHelper = require("./redisHelper");
function sanitize(dirtyString) {
    return dirtyString.replace("[^a-zA-z_0-9]*", "");
}
function stagingAreaKey(plugin) {
    return `staging-area/${sanitize(plugin.name)}`;
}
function actionPrefix(plugin, chainId) {
    return `actions/${sanitize(plugin.name)}/${chainId}/`;
}
function actionKey(plugin, action) {
    return `${actionPrefix(plugin, action.chainId)}${action.id}`;
}
async function createStorage(commonEnv) {
    await RedisHelper.ensureClient();
    return new RedisStorage(RedisHelper);
}
exports.createStorage = createStorage;
function getPluginStorage(plugin) {
    return new RedisPluginStorage(RedisHelper, plugin);
}
exports.getPluginStorage = getPluginStorage;
// Idea is we could have multiple implementations backed by different types of storage
// i.e. RedisStorage, PostgresStorage, MemoryStorage etc.
class RedisStorage {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async getNextAction(chainId, plugins) {
        // todo: ensure one plugin doesn't hog worker
        for (const plugin of plugins) {
            const pluginStorage = this.getPluginStorage(plugin);
            const maybeAction = await pluginStorage.getNextAction(chainId);
            if (maybeAction) {
                return { ...maybeAction, pluginStorage };
            }
        }
        return null;
    }
    async handleStorageStartupConfig(plugins, config) {
        ethers_1.logger.warn("Not implemented");
    }
    getPluginStorage(plugin) {
        return new RedisPluginStorage(this.redis, plugin);
    }
}
exports.RedisStorage = RedisStorage;
class RedisPluginStorage {
    redis;
    plugin;
    constructor(redis, plugin) {
        this.redis = redis;
        this.plugin = plugin;
        this.redis = redis;
    }
    async getNextAction(chainId) {
        const actions = await this.redis.getPrefix(actionPrefix(this.plugin, chainId));
        for (let { key, value } of actions) {
            const storageAction = JSON.parse(value);
            if (storageAction.inProgress) {
                continue;
            }
            if (storageAction.action.delayTimestamp &&
                new Date().getTime() < storageAction.action.delayTimestamp.getTime()) {
                continue;
            }
            const setSuccessfully = await this.redis.compareAndSwap(key, value, JSON.stringify({ action: storageAction.action, inProgress: true }));
            if (setSuccessfully) {
                return {
                    action: storageAction.action,
                    queuedActions: actions.map(({ value }) => JSON.parse(value).action),
                };
            }
        }
        return null;
    }
    async getStagingArea() {
        const key = stagingAreaKey(this.plugin);
        const raw = await this.redis.getItem(key);
        if (!raw) {
            ethers_1.logger.warn(`Missing staging area for plugin ${this.plugin.name}. Returning empty object`);
            return {};
        }
        return JSON.parse(raw);
    }
    async addActions(actionsToAdd) {
        for (const action of actionsToAdd) {
            const key = actionKey(this.plugin, action);
            const storageAction = { action, inProgress: false };
            await this.redis.insertItem(key, JSON.stringify(storageAction));
        }
    }
    async applyActionUpdate(enqueuedActions, consumedAction) {
        await this.redis.removeItem(actionKey(this.plugin, consumedAction));
        await this.addActions(enqueuedActions);
    }
    async saveStagingArea(newStagingArea) {
        await this.redis.insertItem(stagingAreaKey(this.plugin), JSON.stringify(newStagingArea));
    }
}
const toExport = { getPluginStorage };
exports.default = toExport;
//# sourceMappingURL=storage.js.map