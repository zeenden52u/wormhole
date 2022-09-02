module wormhole::BridgeStructs {
    use 0x1::vector::{Self};
    use wormhole::serialize::{serialize_u8, serialize_u16, serialize_u256, serialize_vector};
    use wormhole::deserialize::{deserialize_u8, deserialize_u16, deserialize_u256, deserialize_vector};
    use wormhole::cursor::{Self};

    use wormhole::u256::{U256};
    use wormhole::u16::{U16};

    struct Transfer has key, store, drop{
        // PayloadID uint8 = 1
        payloadID: u8,
        // Amount being transferred (big-endian uint256)
        amount: U256,
        // Address of the token. Left-zero-padded if shorter than 32 bytes
        tokenAddress: vector<u8>,
        // Chain ID of the token
        tokenChain: U16,//should be u16
        // Address of the recipient. Left-zero-padded if shorter than 32 bytes
        to: vector<u8>,
        // Chain ID of the recipient
        toChain: U16,
        // Amount of tokens (big-endian uint256) that the user is willing to pay as relayer fee. Must be <= Amount.
        fee: U256, //should be u256
    }

    struct TransferWithPayload has key, store, drop {
        // PayloadID uint8 = 3
        payloadID: u8,
        // Amount being transferred (big-endian uint256)
        amount: U256, //should be u256
        // Address of the token. Left-zero-padded if shorter than 32 bytes
        tokenAddress: vector<u8>,
        // Chain ID of the token
        tokenChain: U16,
        // Address of the recipient. Left-zero-padded if shorter than 32 bytes
        to: vector<u8>,
        // Chain ID of the recipient
        toChain: U16, //should be u16
        // Address of the message sender. Left-zero-padded if shorter than 32 bytes
        fromAddress: vector<u8>,
        // An arbitrary payload
        payload: vector<u8>,
    }

    struct TransferResult has key, store, drop {
        // Chain ID of the token
        tokenChain: U16,
        // Address of the token. Left-zero-padded if shorter than 32 bytes
        tokenAddress: vector<u8>,
        // Amount being transferred (big-endian uint256)
        normalizedAmount: U256,
        // Amount of tokens (big-endian uint256) that the user is willing to pay as relayer fee. Must be <= Amount.
        normalizedArbiterFee: U256, // should be u256
        // Portion of msg.value to be paid as the core bridge fee
        wormholeFee: U256,
    }

    struct AssetMeta has key, store, drop {
        // PayloadID uint8 = 2
        payloadID: u8,
        // Address of the token. Left-zero-padded if shorter than 32 bytes
        tokenAddress: vector<u8>,
        // Chain ID of the token
        tokenChain: U16,
        // Number of decimals of the token (big-endian uint256)
        decimals: u8,
        // Symbol of the token (UTF-8)
        symbol: vector<u8>,
        // Name of the token (UTF-8)
        name: vector<u8>,
    }

    struct RegisterChain has key, store, drop{
        // Governance Header
        // module: "TokenBridge" left-padded
        mod: vector<u8>, //note: module keyword is reserved in Move
        // governance action: 1
        action: u8,
        // governance paket chain id: this or 0
        chainId: U16,

        // Chain ID
        emitterChainID: U16,
        // Emitter address. Left-zero-padded if shorter than 32 bytes
        emitterAddress: vector<u8>,
    }

    struct UpgradeContract has key, store, drop{
        // Governance Header
        // module: "TokenBridge" left-padded
        mod: vector<u8>, //note: module keyword is reserved in Move
        // governance action: 2
        action: u8,
        // governance packet chain id
        chainId: U16,

        // Address of the new contract
        newContract: vector<u8>,
    }

    public fun encodeAssetMeta(meta: AssetMeta): vector<u8> {
        let encoded = vector::empty<u8>();
        serialize_u8(&mut encoded, meta.payloadID);
        serialize_vector(&mut encoded, meta.tokenAddress);
        serialize_u16(&mut encoded, meta.tokenChain);
        serialize_u8(&mut encoded, meta.decimals);
        serialize_vector(&mut encoded, meta.symbol);
        serialize_vector(&mut encoded, meta.name);
        encoded
    }

    public fun encodeTransfer(transfer: Transfer): vector<u8> {
        let encoded = vector::empty<u8>();
        serialize_u8(&mut encoded, transfer.payloadID);
        serialize_u256(&mut encoded, transfer.amount);
        serialize_vector(&mut encoded, transfer.tokenAddress);
        serialize_u16(&mut encoded, transfer.tokenChain);
        serialize_vector(&mut encoded, transfer.to);
        serialize_u16(&mut encoded, transfer.toChain);
        serialize_u256(&mut encoded, transfer.fee);
        encoded
    }

    public fun encodeTransferWithPayload(transfer: TransferWithPayload): vector<u8> {
        let encoded = vector::empty<u8>();
        serialize_u8(&mut encoded, transfer.payloadID);
        serialize_u256(&mut encoded, transfer.amount);
        serialize_vector(&mut encoded, transfer.tokenAddress);
        serialize_u16(&mut encoded, transfer.tokenChain);
        serialize_vector(&mut encoded, transfer.to);
        serialize_u16(&mut encoded, transfer.toChain);
        serialize_vector(&mut encoded, transfer.fromAddress);
        serialize_vector(&mut encoded, transfer.payload);
        encoded
    }

    public fun parseAssetMeta(meta: vector<u8>): AssetMeta {
        let cur = cursor::init(meta);
        let payloadID = deserialize_u8(&mut cur);
        let tokenAddress = deserialize_vector(&mut cur, 32);
        let tokenChain = deserialize_u16(&mut cur);
        let decimals = deserialize_u8(&mut cur);
        let symbol = deserialize_vector(&mut cur, 32);
        let name = deserialize_vector(&mut cur, 32);
        cursor::destroy_empty(cur);
        AssetMeta {
            payloadID,
            tokenAddress,
            tokenChain,
            decimals,
            symbol,
            name
        }
    }

    public fun parseTransfer(transfer: vector<u8>): Transfer{
        let cur = cursor::init(transfer);
        let payloadID = deserialize_u8(&mut cur);
        let amount = deserialize_u256(&mut cur);
        let tokenAddress = deserialize_vector(&mut cur, 32);
        let tokenChain = deserialize_u16(&mut cur);
        let to = deserialize_vector(&mut cur, 32);
        let toChain = deserialize_u16(&mut cur);
        let fee = deserialize_u256(&mut cur);
        cursor::destroy_empty(cur);
        Transfer {
            payloadID,
            amount,
            tokenAddress,
            tokenChain,
            to,
            toChain,
            fee
        }
    }

    public fun parseTransferWithPayload(transfer: vector<u8>): TransferWithPayload{
        let cur = cursor::init(transfer);
        let payloadID = deserialize_u8(&mut cur);
        let amount = deserialize_u256(&mut cur);
        let tokenAddress = deserialize_vector(&mut cur, 32);
        let tokenChain = deserialize_u16(&mut cur);
        let to = deserialize_vector(&mut cur, 32);
        let toChain = deserialize_u16(&mut cur);
        let fromAddress = deserialize_vector(&mut cur, 32);
        let n = cursor::length<u8>(&cur);
        let payload = deserialize_vector(&mut cur, n);
        cursor::destroy_empty(cur);
        TransferWithPayload {
            payloadID,
            amount,
            tokenAddress,
            tokenChain,
            to,
            toChain,
            fromAddress,
            payload
        }
    }
}
