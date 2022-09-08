"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPlugin = exports.loadPlugins = void 0;
const loadConfig_1 = require("./config/loadConfig");
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
    const plugins = await Promise.all(commonEnv.pluginURIs.map(uri => loadPlugin(uri, commonEnv)));
    logger.info(`Loaded ${plugins.length} plugins`);
    return plugins;
}
exports.loadPlugins = loadPlugins;
async function loadPlugin(uri, commonEnv) {
    const module = (await Promise.resolve().then(() => require(uri)));
    const pluginEnv = await (0, loadConfig_1.loadPluginConfig)(module.pluginName, uri, commonEnv.envType);
    return module.create(commonEnv, pluginEnv);
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