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
const configureEnv_1 = require("./configureEnv");
const executorHarness = require("./executor/executorHarness");
const logHelper_1 = require("./helpers/logHelper");
const promHelpers_1 = require("./helpers/promHelpers");
// import * as redisHelper from "./helpers/redisHelper";
const storage_1 = require("./helpers/storage");
const listenerHarness = require("./listener/listenerHarness");
const loadPlugins_1 = require("./loadPlugins");
(0, wasm_1.setDefaultWasm)("node");
// instantiate common environment
const commonEnv = (0, configureEnv_1.getCommonEnvironment)();
const logger = (0, logHelper_1.getLogger)();
async function main() {
    const plugins = await (0, loadPlugins_1.loadPlugins)(commonEnv);
    const storage = await (0, storage_1.createStorage)(commonEnv);
    if (process.env.MODE === "listener") {
        // init listener harness
        const promHelper = new promHelpers_1.PromHelper("plugin_relayer", commonEnv.promPort, promHelpers_1.PromMode.Listen);
        await listenerHarness.run(plugins, storage);
    }
    else if (process.env.MODE === "executor") {
        // init executor harness
        const promHelper = new promHelpers_1.PromHelper("plugin_relayer", commonEnv.promPort, promHelpers_1.PromMode.Execute);
        executorHarness.run(plugins, storage);
    }
    else {
        throw new Error("Expected MODE env var to be listener or executor, instead got: " +
            process.env.MODE);
    }
}
if (commonEnv.readinessPort) {
    const Net = require("net");
    const readinessServer = new Net.Server();
    readinessServer.listen(commonEnv.readinessPort, function () {
        logger.info("listening for readiness requests on port " + commonEnv.readinessPort);
    });
    readinessServer.on("connection", function (socket) {
        //logger.debug("readiness connection");
    });
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=main.js.map