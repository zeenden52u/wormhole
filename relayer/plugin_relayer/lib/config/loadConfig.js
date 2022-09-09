"use strict";
/*
 * Loads config files and env vars, resolves them into untyped objects
 */
// const configFile: string = process.env.SPY_RELAY_CONFIG
//   ? process.env.SPY_RELAY_CONFIG
//   : ".env.sample";
// console.log("loading config file [%s]", configFile);
// config({ path: configFile });
// export {};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPluginConfig = exports.loadUntypedEnvs = exports.envTypeToPath = exports.Mode = void 0;
const yaml = require("js-yaml");
const fs = require("fs/promises");
const nodePath = require("path");
const validateConfig_1 = require("./validateConfig");
const plugin_interface_1 = require("plugin_interface");
var Mode;
(function (Mode) {
    Mode["LISTENER"] = "LISTENER";
    Mode["EXECUTOR"] = "EXECUTOR";
})(Mode = exports.Mode || (exports.Mode = {}));
function envTypeToPath(envType) {
    return envType.toLowerCase();
}
exports.envTypeToPath = envTypeToPath;
async function loadUntypedEnvs() {
    const modeString = process.env.MODE && process.env.MODE.toUpperCase();
    const envTypeString = process.env.ENV_TYPE && process.env.ENV_TYPE.toUpperCase();
    const mode = (0, validateConfig_1.validateStringEnum)(Mode, modeString);
    const envType = (0, validateConfig_1.validateStringEnum)(plugin_interface_1.EnvTypes, envTypeString ? envTypeString : plugin_interface_1.EnvTypes.MAINNET);
    console.log(`Starting common config load for env: ${envTypeString}, mode: ${modeString}`);
    const rawCommonEnv = await loadCommon(envType, mode);
    console.log("Successfully loaded the common config file.");
    const listenerOrExecutor = await loadListenerOrExecutor(envType, mode);
    console.log("Successfully loaded the mode config file.");
    return {
        rawCommonEnv: rawCommonEnv,
        rawListenerOrExecutorEnv: listenerOrExecutor,
        mode,
    };
}
exports.loadUntypedEnvs = loadUntypedEnvs;
async function loadCommon(envType, mode) {
    const obj = await loadFileAndParseToObject(`./config/${envTypeToPath(envType)}/common.yml`);
    obj.mode = mode;
    return obj;
}
async function loadListenerOrExecutor(envType, mode) {
    return await loadFileAndParseToObject(`./config/${envTypeToPath(envType)}/${mode.toLowerCase()}.yml`);
}
async function loadPluginConfig(pluginName, pluginURI, envType) {
    const overrides = loadFileAndParseToObject(`./config/${envTypeToPath(envType)}/plugins/${pluginName}.yml`);
    const defaultConfig = loadFileAndParseToObject(`./node_modules/${pluginURI}/config/${envTypeToPath(envType)}.yml`);
    return { ...(await defaultConfig), ...(await overrides) };
}
exports.loadPluginConfig = loadPluginConfig;
// todo: extend to take path w/o extension and look for all supported extensions
async function loadFileAndParseToObject(path) {
    console.log("About to read contents of : " + path);
    const fileContent = await fs.readFile(path, { encoding: "utf-8" });
    console.log("Successfully read file contents");
    const ext = nodePath.extname(path);
    switch (ext) {
        case ".json":
            return JSON.parse(fileContent);
        case ".yaml":
            return yaml.load(fileContent, {
                schema: yaml.JSON_SCHEMA,
            });
        case ".yml":
            return yaml.load(fileContent, {
                schema: yaml.JSON_SCHEMA,
            });
        default:
            const err = new Error("Config file has unsupported extension");
            err.ext = ext;
            err.path = path;
            throw err;
    }
}
// async function loadPluginEnvs<T>(
//   envType: EnvType,
//   pluginUris: NodeURI[]
// ): Promise<Record<string, any>[]> {}
//# sourceMappingURL=loadConfig.js.map