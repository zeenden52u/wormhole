"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPlugin = exports.loadPlugins = void 0;
const logHelper_1 = require("./helpers/logHelper");
/*
  1. read plugin URIs from common config
  For Each
    a. dynamically load plugin
    b. look for plugin overrides in common config
    c. construct plugin
 */
async function loadPlugins(commonEnv) {
    const logger = (0, logHelper_1.getLogger)();
    logger.info("Loading plugins...");
    const plugins = await Promise.all(commonEnv.plugins.map(({ uri, overrides }) => loadPlugin(uri, overrides, commonEnv)));
    logger.info(`Loaded ${plugins.length} plugins`);
    return plugins;
}
exports.loadPlugins = loadPlugins;
async function loadPlugin(uri, overrides, commonEnv) {
    const module = (await Promise.resolve().then(() => require(uri)));
    return module.create(commonEnv, overrides);
}
exports.loadPlugin = loadPlugin;
/* uncomment and run with ts-node loadPlugins.ts to test separately */
// loadPlugins({
//   plugins: [{ uri: "dummy_plugin", overrides: {key: "val"} }],
//   logLevel: "",
//   promPort: 0,
//   redisHost: "",
//   redisPort: 0,
//   envType: "",
// }).then((e) => {
//   console.error(e);
//   process.exit(1);
// });
//# sourceMappingURL=loadPlugins.js.map