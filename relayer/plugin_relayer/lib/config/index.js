"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvs = exports.loadAndValidateConfig = exports.getListenerEnv = exports.getExecutorEnv = exports.getCommonEnv = void 0;
const loadConfig_1 = require("./loadConfig");
const validateConfig_1 = require("./validateConfig");
let loggingEnv = undefined;
let executorEnv = undefined;
let commonEnv = undefined;
let listenerEnv = undefined;
function getCommonEnv() {
    if (!commonEnv) {
        throw new Error("Tried to get CommonEnv but it does not exist. Has it been loaded yet?");
    }
    return commonEnv;
}
exports.getCommonEnv = getCommonEnv;
function getExecutorEnv() {
    if (!executorEnv) {
        throw new Error("Tried to get ExecutorEnv but it does not exist. Has it been loaded yet?");
    }
    return executorEnv;
}
exports.getExecutorEnv = getExecutorEnv;
function getListenerEnv() {
    if (!listenerEnv) {
        throw new Error("Tried to get ListenerEnv but it does not exist. Has it been loaded yet?");
    }
    return listenerEnv;
}
exports.getListenerEnv = getListenerEnv;
function loadAndValidateConfig() {
    return (0, loadConfig_1.loadUntypedEnvs)().then(validateEnvs);
}
exports.loadAndValidateConfig = loadAndValidateConfig;
function validateEnvs({ mode, rawCommonEnv, rawListenerOrExecutorEnv, }) {
    console.log("Validating envs...");
    commonEnv = (0, validateConfig_1.validateCommonEnv)(rawCommonEnv);
    if (mode === loadConfig_1.Mode.EXECUTOR) {
        executorEnv = (0, validateConfig_1.validateExecutorEnv)(rawListenerOrExecutorEnv);
    }
    else if (mode === loadConfig_1.Mode.LISTENER) {
        listenerEnv = (0, validateConfig_1.validateListenerEnv)(rawListenerOrExecutorEnv);
    }
    else {
        throw new Error("Unexpected mode: " + mode);
    }
    console.log("Validated envs");
}
exports.validateEnvs = validateEnvs;
//# sourceMappingURL=index.js.map