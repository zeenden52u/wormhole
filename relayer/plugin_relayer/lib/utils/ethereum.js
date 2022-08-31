"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEthereumToken = void 0;
const wormhole_sdk_1 = require("@certusone/wormhole-sdk");
async function getEthereumToken(tokenAddress, provider) {
    const token = wormhole_sdk_1.TokenImplementation__factory.connect(tokenAddress, provider);
    return token;
}
exports.getEthereumToken = getEthereumToken;
//# sourceMappingURL=ethereum.js.map