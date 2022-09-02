module token_bridge::TokenBridge {
    use 0x1::type_info::{Self, TypeInfo};
    use token_bridge::BridgeState::{setOutstandingBridged, outstandingBridged, bridgeContracts};
    //use Wormhole::BridgeStructs::{AssetMeta, Transfer, TransferWithPayload};
    use token_bridge::BridgeStructs::{TransferResult};

    use wormhole::u256::{Self, U256};
    //use wormhole::u128::{U128};
    use wormhole::u32::{Self, U32};
    use wormhole::u16::{Self, U16};

    use wormhole::vaa::{Self, VAA, parse_and_verify};

    public entry fun attest_token<CoinType>(deployer: address){
        // TODO
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
