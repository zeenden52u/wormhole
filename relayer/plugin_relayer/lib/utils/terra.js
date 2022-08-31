"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatNativeDenom = exports.LUNA_CLASSIC_SYMBOL = exports.LUNA_SYMBOL = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
exports.LUNA_SYMBOL = "LUNA";
exports.LUNA_CLASSIC_SYMBOL = "LUNC";
const formatNativeDenom = (denom, chainId) => {
    const unit = denom.slice(1).toUpperCase();
    const isValidTerra = (0, wormhole_sdk_1.isNativeTerra)(denom);
    return denom === "uluna"
        ? chainId === wormhole_sdk_1.CHAIN_ID_TERRA2
            ? exports.LUNA_SYMBOL
            : exports.LUNA_CLASSIC_SYMBOL
        : isValidTerra
            ? unit.slice(0, 2) + "TC"
            : "";
};
exports.formatNativeDenom = formatNativeDenom;
//# sourceMappingURL=terra.js.map