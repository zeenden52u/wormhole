//
// Implementations for wrapped asset creation and token transfers 
// (TokenTransferWithPayload, TokenTransfer, CreateWrapped)
//
module token_bridge::TokenBridge {
    use 0x1::type_info::{Self, type_of, TypeInfo};
    use 0x1::coin::{name, symbol, decimals};
    use token_bridge::BridgeState::{setOutstandingBridged, outstandingBridged, bridgeContracts, chainId};
    //use Wormhole::BridgeStructs::{AssetMeta, Transfer, TransferWithPayload};
    use token_bridge::BridgeStructs::{TransferResult, AssetMeta, create_asset_meta};

    use wormhole::u256::{Self, U256};
    //use wormhole::u128::{U128};
    use wormhole::u32::{Self, U32};
    use wormhole::u16::{Self, U16};
    use wormhole::state::{publish_message};

    use wormhole::vaa::{Self, VAA, parse_and_verify};

// //  struct CoinInfo<phantom CoinType> has key {
//         name: string::String,
//         /// Symbol of the coin, usually a shorter version of the name.
//         /// For example, Singapore Dollar is SGD.
//         symbol: string::String,
//         /// Number of decimals used to get its user representation.
//         /// For example, if `decimals` equals `2`, a balance of `505` coins should
//         /// be displayed to a user as `5.05` (`505 / 10 ** 2`).
//         decimals: u8,
//         /// Amount of this coin type in existence.
//         supply: Option<OptionalAggregator>,
//     }

    public entry fun attest_token<CoinType>(deployer: address){
        // TODO
        // publish a message containing the struct AssetMeta
        //let t = type_of(CoinType);
        let payload_id = 0;
        let token_address = type_info::address(CoinType);
        let token_chain = chainId();
        let decimals = decimals<CoinType>();
        let symbol = symbol<CoinType>();
        let name = name<CoinType>();

        let asset_meta = create_asset_meta(
            payload_id,
            token_address,
            token_chain,
            decimals,
            symbol,
            name
        )
        // load token bridge signer capability

        publish_message
        publish_message(
        sender: &signer,
        nonce: u64,
        payload: vector<u8>,
        consistency_level: u8,
     ) 

    }

    public entry fun create_wrapped(encodedVM: vector<u8>){
        //let (vaa, result, reason) = parseAndVerifyVAA(encodedVM);
        //VAA::destroy(vaa);
        // TODO
    }

    public entry fun transfer_tokens_with_payload (
        token: vector<u8>,
        amount: U256,
        recipientChain: U16,
        recipient: vector<u8>,
        nonce: U32,
        payload: vector<u8>
    ) {
        //TODO
    }

    /*
     *  @notice Initiate a transfer
     */
    fun transfer_tokens_(token: TypeInfo, amount: u128, arbiterFee: u128) {//returns TransferResult
        // TODO
    }

    fun bridge_out(token: vector<u8>, normalizedAmount: U256) {
        // TODO
        //let outstanding = outstandingBridged(token);
        //let lhs = u256::add(outstanding, normalizedAmount);
        //assert!(u256::compare(lhs, &(2<<128-1))==1, 0); //LHS is less than RHS
        //setOutstandingBridged(token, u256::add(outstanding, normalizedAmount));
    }

    fun bridged_in(token: vector<u8>, normalizedAmount: U256) {
        setOutstandingBridged(token, u256::sub(outstandingBridged(token), normalizedAmount));
    }

    fun verify_bridge_vm(vm: &VAA): bool{
        if (bridgeContracts(vaa::get_emitter_chain(vm)) == vaa::get_emitter_address(vm)) {
            return true
        };
        return false
    }

}
