"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSOL_DECIMALS = exports.shortenAddress = exports.chunks = exports.getMultipleAccounts = exports.getMultipleAccountsRPC = void 0;
async function getMultipleAccountsRPC(connection, pubkeys) {
    return (0, exports.getMultipleAccounts)(connection, pubkeys, "confirmed");
}
exports.getMultipleAccountsRPC = getMultipleAccountsRPC;
const getMultipleAccounts = async (connection, pubkeys, commitment) => {
    return (await Promise.all(chunks(pubkeys, 99).map((chunk) => connection.getMultipleAccountsInfo(chunk, commitment)))).flat();
};
exports.getMultipleAccounts = getMultipleAccounts;
function chunks(array, size) {
    return Array.apply(0, new Array(Math.ceil(array.length / size))).map((_, index) => array.slice(index * size, (index + 1) * size));
}
exports.chunks = chunks;
function shortenAddress(address) {
    return address.length > 10
        ? `${address.slice(0, 4)}...${address.slice(-4)}`
        : address;
}
exports.shortenAddress = shortenAddress;
exports.WSOL_DECIMALS = 9;
//# sourceMappingURL=solana.js.map