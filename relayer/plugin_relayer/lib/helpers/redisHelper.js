"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareAndSwap = exports.ensureClient = exports.getItem = exports.removeItem = exports.insertItem = exports.executeBacklog = exports.getPrefix = exports.init = void 0;
const async_mutex_1 = require("async-mutex");
const redis_1 = require("redis");
const configureEnv_1 = require("../configureEnv");
const logHelper_1 = require("./logHelper");
const logger = (0, logHelper_1.getScopedLogger)(["redisHelper"]);
const commonEnv = (0, configureEnv_1.getCommonEnvironment)();
const { redisHost, redisPort } = commonEnv;
let promHelper;
function init(ph) {
    logger.info("will connect to redis at [" + redisHost + ":" + redisPort + "]");
    promHelper = ph;
    return true;
}
exports.init = init;
let rClient;
async function createConnection() {
    try {
        let client = (0, redis_1.createClient)({
            socket: {
                host: commonEnv.redisHost,
                port: commonEnv.redisPort,
            },
        });
        client.on("connect", function (err) {
            if (err) {
                logger.error("connectToRedis: failed to connect to host [" +
                    redisHost +
                    "], port [" +
                    redisPort +
                    "]: %o", err);
            }
        });
        await client.connect();
        rClient = client;
        return nnull(client);
    }
    catch (e) {
        logger.error("connectToRedis: failed to connect to host [" +
            redisHost +
            "], port [" +
            redisPort +
            "]: %o", e);
        throw new Error("Could not connect to Redis");
    }
}
async function getClient() {
    if (!rClient) {
        rClient = await createConnection();
    }
    return nnull(rClient);
}
async function getPrefix(prefix) {
    const client = await getClient();
    const iterator = await client.scanIterator({ MATCH: prefix + "*" });
    const output = [];
    for await (const key of iterator) {
        output.push({ key, value: await client.get(key) });
    }
    return output;
}
exports.getPrefix = getPrefix;
/*
async function insertItemToHashMap(
  mapKey: string,
  fieldKey: string,
  value: string
): Promise<boolean> {
  try {
    logger.debug(
      `Inserting into redis hash set: ${mapKey}, key: ${fieldKey}, value: ${value}`
    );
    const client = await getClient();
    client.hSet(mapKey, fieldKey, value);
    logger.debug(`Done inserting key: ${fieldKey} into ${mapKey}`);
    return true;
  } catch (e) {
    logger.error(
      `Failed inserting into redis hash set: ${mapKey}, key: ${fieldKey}, value: ${value}`
    );
    return false;
  }
}
*/
//The backlog is a FIFO queue of outstanding redis operations
let backlog = [];
let mutex = new async_mutex_1.Mutex();
async function enqueueOp(op) {
    backlog.push(op);
    await executeBacklog();
}
// This process executes the backlog periodically, so that items inside the backlog
// do not need to wait for a new item to enter the backlog before they can execute again
setInterval(executeBacklog, 1000 * 60);
async function executeBacklog() {
    await mutex.runExclusive(async () => {
        for (let i = 0; i < backlog.length; ++i) {
            try {
                await backlog[i]();
            }
            catch (e) {
                backlog = backlog.slice(i);
                logger.error(e);
                return;
            }
        }
        backlog = [];
    });
}
exports.executeBacklog = executeBacklog;
async function insertItem(key, value) {
    //Insert item into end of backlog
    const wrappedOp = async () => {
        logger.debug(`Inserting into redis key: ${key}, value: ${value}`);
        const client = await getClient();
        await client.set(key, value);
        logger.debug(`Done inserting key: ${key}`);
    };
    await enqueueOp(wrappedOp);
}
exports.insertItem = insertItem;
async function removeItem(key) {
    const wrappedOp = async () => {
        logger.debug(`removing redis key: ${key}`);
        const client = await getClient();
        await client.del(key);
        logger.debug(`Done removing key: ${key}`);
    };
    await enqueueOp(wrappedOp);
}
exports.removeItem = removeItem;
async function getItem(key) {
    const client = await getClient();
    return await client.get(key);
}
exports.getItem = getItem;
async function ensureClient() {
    await getClient();
}
exports.ensureClient = ensureClient;
//This function can modify an existing record.
//It will first make sure that the existing record has not been modified by a different process.
async function compareAndSwap(prefix, previousValue, newValue) {
    return await mutex.runExclusive(async () => {
        try {
            const client = await getClient();
            const itemInRedis = await client.get(prefix);
            if (itemInRedis !== previousValue) {
                logger.info("Compare and swap failed");
                return false;
            }
            await client.set(prefix, newValue);
        }
        catch (e) {
            logger.error("Failed compare and swap");
            logger.error(e);
            return false;
        }
    });
}
exports.compareAndSwap = compareAndSwap;
function nnull(x) {
    return x;
}
const _1 = {
    ensureClient,
    insertItem,
    getPrefix,
    getItem,
    compareAndSwap,
    removeItem,
};
//# sourceMappingURL=redisHelper.js.map