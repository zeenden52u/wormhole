"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPlugin = exports.loadPlugins = void 0;
const loadConfig_1 = require("./config/loadConfig");
const logHelper_1 = require("./helpers/logHelper");
/*
  1. read plugin URIs from common config
  For Each
    a. dynamically load plugin
    b. load plugin config files (default and override)
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
    const module = (await Promise.resolve().then(() => require(uri))).default;
    const pluginEnv = await (0, loadConfig_1.loadPluginConfig)(module.pluginName, uri, commonEnv.envType);
    const logger = (0, logHelper_1.getScopedLogger)([module.pluginName], (0, logHelper_1.getLogger)());
    return module.create(commonEnv, pluginEnv, logger);
}
exports.loadPlugin = loadPlugin;
//# sourceMappingURL=loadPlugins.js.map