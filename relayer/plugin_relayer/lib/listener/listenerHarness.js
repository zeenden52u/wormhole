"use strict";
/*
1. Grab Logger & Common Env
2. Instantiate Listener Env
3. Instantiate Redis Connection
4. Optionally Instantiate Spy Connection
5. Optionally Instantiate REST Connection
6.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const configureEnv_1 = require("../configureEnv");
const logHelper_1 = require("../helpers/logHelper");
const wormhole_spydk_1 = require("@certusone/wormhole-spydk");
const utils_1 = require("../helpers/utils");
const logger = (0, logHelper_1.getScopedLogger)(["listenerHarness"], (0, logHelper_1.getLogger)());
const commonEnv = (0, configureEnv_1.getCommonEnvironment)();
async function run(plugins, storage) {
    const listnerEnv = (0, configureEnv_1.getListenerEnvironment)();
    //if spy is enabled, instantiate spy with filters
    if (shouldSpy(plugins)) {
        const spyClient = (0, wormhole_spydk_1.createSpyRPCServiceClient)(listnerEnv.spyServiceHost || "");
        plugins.forEach((plugin) => {
            if (plugin.shouldSpy) {
                runPluginSpyListener(storage.getPluginStorage(plugin), spyClient);
            }
        });
    }
    //if rest is enabled, instantiate rest with filters
    if (shouldRest(plugins)) {
        //const restListener = setupRestListener(restFilters);
    }
}
exports.run = run;
function shouldRest(plugins) {
    return plugins.some((x) => x.shouldRest);
}
function shouldSpy(plugins) {
    return plugins.some((x) => x.shouldSpy);
}
// 1. fetches scratch area and list of actions
// 2. calls plugin.consumeEvent(..)
// 3. applies ActionUpdate produced by plugin
async function consumeEventHarness(vaa, storage) {
    try {
        const stagingArea = await storage.getStagingArea();
        const { actions, nextStagingArea } = await storage.plugin.consumeEvent(vaa, stagingArea);
        await storage.addActions(actions);
        await storage.saveStagingArea(nextStagingArea);
    }
    catch (e) {
        logger.error(e);
        // metric onError
    }
}
//used for both rest & spy relayer for now
async function runPluginSpyListener(pluginStorage, client) {
    const plugin = pluginStorage.plugin;
    while (true) {
        let stream;
        try {
            stream = await (0, wormhole_spydk_1.subscribeSignedVAA)(client, {
                filters: plugin.getFilters().map((x) => {
                    return {
                        emitterFilter: x,
                    };
                }),
            });
            //TODO add staging area for event consume
            stream.on("data", (vaa) => consumeEventHarness(vaa, pluginStorage));
            let connected = true;
            stream.on("error", (err) => {
                logger.error("spy service returned an error: %o", err);
                connected = false;
            });
            stream.on("close", () => {
                logger.error("spy service closed the connection!");
                connected = false;
            });
            logger.info("connected to spy service, listening for transfer signed VAAs");
            while (connected) {
                await (0, utils_1.sleep)(1000);
            }
        }
        catch (e) {
            logger.error("spy service threw an exception: %o", e);
        }
        stream.destroy();
        await (0, utils_1.sleep)(5 * 1000);
        logger.info("attempting to reconnect to the spy service");
    }
}
//# sourceMappingURL=listenerHarness.js.map