"use strict";
/*
1 Load config files onto process environment
2 Init Logging
3 Create The Common Environment
4 Init Plugins
5 Branch, based on Listen or Execute

Listen Path
-Init Listener

Execute
-Init Executor
*/
Object.defineProperty(exports, "__esModule", { value: true });
require("./helpers/loadConfig");
const wasm_1 = require("@certusone/wormhole-sdk/lib/cjs/solana/wasm");
const executorHarness = require("./executor/executorHarness");
const logHelper_1 = require("./helpers/logHelper");
const promHelpers_1 = require("./helpers/promHelpers");
// import * as redisHelper from "./helpers/redisHelper";
const storage_1 = require("./helpers/storage");
const listenerHarness = require("./listener/listenerHarness");
const loadPlugins_1 = require("./loadPlugins");
const config_1 = require("./config");
const config_2 = require("./config");
(0, wasm_1.setDefaultWasm)("node");
// instantiate common environment
async function main() {
    await (0, config_2.loadAndValidateConfig)();
    const commonEnv = (0, config_1.getCommonEnv)();
    console.log("here");
    const logger = (0, logHelper_1.getLogger)();
    const plugins = await (0, loadPlugins_1.loadPlugins)(commonEnv);
    const storage = await (0, storage_1.createStorage)(commonEnv);
    launchReadinessPortTask();
    if (process.env.MODE === "listener") {
        logger.info("Running in listener mode");
        // init listener harness
        const promHelper = new promHelpers_1.PromHelper("plugin_relayer", commonEnv.promPort, promHelpers_1.PromMode.Listen);
        await listenerHarness.run(plugins, storage);
    }
    else if (process.env.MODE === "executor") {
        logger.info("Running in executor mode");
        // init executor harness
        const promHelper = new promHelpers_1.PromHelper("plugin_relayer", commonEnv.promPort, promHelpers_1.PromMode.Execute);
        executorHarness.run(plugins, storage);
    }
    else {
        throw new Error("Expected MODE env var to be listener or executor, instead got: " +
            process.env.MODE);
    }
}
async function launchReadinessPortTask() {
    const commonEnv = (0, config_1.getCommonEnv)();
    if (commonEnv.readinessPort) {
        const Net = await Promise.resolve().then(() => require("net"));
        const readinessServer = new Net.Server();
        readinessServer.listen(commonEnv.readinessPort, function () {
            (0, logHelper_1.getLogger)().info("listening for readiness requests on port " + commonEnv.readinessPort);
        });
        readinessServer.on("connection", function (socket) {
            //logger.debug("readiness connection");
        });
    }
}
main().catch(e => {
    console.error("Fatal Error");
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=main.js.map