"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const configFile = process.env.SPY_RELAY_CONFIG
    ? process.env.SPY_RELAY_CONFIG
    : ".env.sample";
console.log("loading config file [%s]", configFile);
(0, dotenv_1.config)({ path: configFile });
//# sourceMappingURL=loadConfig.js.map