module token_bridge::BridgeState {

    use 0x1::table::{Self, Table};
    use 0x1::type_info::{TypeInfo};
    use 0x1::account::{SignerCapability};

    use wormhole::u256::{U256};
    use wormhole::u16::{U16};

    struct Provider has key, store {
        chainId: U16,
        governanceChainId: U16,
        // Required number of block confirmations to assume finality
        finality: u8,
        governanceContract: vector<u8>,
    }

    struct Asset has key, store {
        chainId: U16,
        assetAddress: vector<u8>,
    }

    struct State has key, store {
        wormhole: address,
        //  address tokenImplementation, - not needed, because there is canonical coin module?

        provider: Provider,

        // Mapping of consumed governance actions
        consumedGovernanceActions: Table<vector<u8>, bool>,

        // Mapping of consumed token transfers
        completedTransfers: Table<vector<u8>, bool>,

        // Mapping of initialized implementations
        initializedImplementations: Table<address, bool>,

        // Mapping of wrapped assets (chainID => nativeAddress => wrappedAddress)
        //
        // A Wormhole wrapped coin on Aptos is identified by a single address, because
        // we assume it was initialized from the CoinType "deployer::coin::T", where the module and struct
        // names are fixed.
        //
        wrappedAssets: Table<U16, Table<vector<u8>, vector<u8>>>,

        // https://github.com/aptos-labs/aptos-core/blob/devnet/aptos-move/framework/aptos-stdlib/sources/type_info.move
        // Mapping of native asset TypeInfo sha3_256 hash (32 bytes) => TypeInfo
        // We have to identify native assets using a 32 byte identifier, because that is what fits in
        // TokenTransferWithPayload struct, among others.
        nativeAssets: Table<vector<u8>, TypeInfo>,

        // Mapping to safely identify wrapped assets
        isWrappedAsset: Table<vector<u8>, bool>,

        wrappedAssetSignerCapabilities: Table<vector<u8>, SignerCapability>,

        // Mapping to safely identify native assets from a 32 byte hash of its TypeInfo
        isNativeAsset: Table<vector<u8>, bool>,

        // Mapping of native assets to amount outstanding on other chains
        outstandingBridged: Table<vector<u8>, U256>, // should be address => u256

        // Mapping of bridge contracts on other chains
        bridgeImplementations: Table<U16, vector<u8>>, //should be u16=>vector<u8>
    }

    // getters

    public entry fun governanceActionIsConsumed(hash: vector<u8>): bool acquires State{
        let state = borrow_global<State>(@token_bridge);
        return *table::borrow(&state.consumedGovernanceActions, hash)
    }

    // TODO: isInitialized?

    public entry fun isTransferCompleted(hash: vector<u8>): bool acquires State{
        let state = borrow_global<State>(@token_bridge);
        return *table::borrow(&state.completedTransfers, hash)
    }

    public entry fun wormhole(): address acquires State{
        let state = borrow_global<State>(@token_bridge);
        return state.wormhole
    }

    public entry fun chainId(): U16 acquires State{ //should return u16
        let state = borrow_global<State>(@token_bridge);
        return state.provider.chainId
    }

    public entry fun governanceChainId(): U16 acquires State{ //should return u16
        let state = borrow_global<State>(@token_bridge);
        return state.provider.governanceChainId
    }

    public entry fun governanceContract(): vector<u8> acquires State{ //should return u16
        let state = borrow_global<State>(@token_bridge);
        return state.provider.governanceContract
    }

    public entry fun wrappedAsset(tokenChainId: U16, tokenAddress: vector<u8>): vector<u8> acquires State{
        let state = borrow_global<State>(@token_bridge);
        let inner = table::borrow(&state.wrappedAssets, tokenChainId);
        *table::borrow(inner, tokenAddress)
    }

    public entry fun nativeAsset(tokenAddress: vector<u8>): TypeInfo acquires State{
        let native_assets = &borrow_global<State>(@token_bridge).nativeAssets;
        *table::borrow(native_assets, tokenAddress)
    }

    public entry fun bridgeContracts(chainId: U16): vector<u8> acquires State{
        let state = borrow_global<State>(@token_bridge);
        *table::borrow(&state.bridgeImplementations, chainId)
    }

    public entry fun outstandingBridged(token: vector<u8>): U256 acquires State{
        let state = borrow_global<State>(@token_bridge);
        *table::borrow(&state.outstandingBridged, token)
    }

    public entry fun isWrappedAsset(token: vector<u8>): bool acquires State {
        let state = borrow_global<State>(@token_bridge);
         *table::borrow(&state.isWrappedAsset, token)
    }

    public entry fun finality(): u8 acquires State {
        let state = borrow_global<State>(@token_bridge);
        state.provider.finality
    }

    // setters

    // function setInitialized(address implementatiom) internal {
    //     _state.initializedImplementations[implementatiom] = true;
    // }

    public entry fun setGovernanceActionConsumed(hash: vector<u8>) acquires State {
        let state = borrow_global_mut<State>(@token_bridge);
        if (table::contains(&state.consumedGovernanceActions, hash)){
            table::remove(&mut state.consumedGovernanceActions, hash);
        };
        table::add(&mut state.consumedGovernanceActions, hash, true);
    }

    public entry fun setTransferCompleted(hash: vector<u8>) acquires State {
        let state = borrow_global_mut<State>(@token_bridge);
        if (table::contains(&state.completedTransfers, hash)){
            table::remove(&mut state.completedTransfers, hash);
        };
        table::add(&mut state.completedTransfers, hash, true);
    }

    public entry fun setChainId(chainId: U16) acquires State {
        let state = borrow_global_mut<State>(@token_bridge);
        let provider = &mut state.provider;
        provider.chainId = chainId;
    }

    public entry fun setGovernanceChainId(governanceChainId: U16) acquires State {
        let state = borrow_global_mut<State>(@token_bridge);
        let provider = &mut state.provider;
        provider.governanceChainId = governanceChainId;
    }

    public entry fun setGovernanceContract(governanceContract: vector<u8>) acquires State {
        let state = borrow_global_mut<State>(@token_bridge);
        let provider = &mut state.provider;
        provider.governanceContract=governanceContract;
    }

    public entry fun setBridgeImplementation(chainId: U16, bridgeContract: vector<u8>) acquires State {
        let state = borrow_global_mut<State>(@token_bridge);
        if (table::contains(&state.bridgeImplementations, chainId)){
            table::remove(&mut state.bridgeImplementations, chainId);
        };
        table::add(&mut state.bridgeImplementations, chainId, bridgeContract);
    }

    public entry fun setWormhole(wh: address) acquires State{
        let state = borrow_global_mut<State>(@token_bridge);
        state.wormhole = wh;
    }

    public entry fun setWrappedAsset(tokenChainId: U16, tokenAddress: vector<u8>, wrapper: vector<u8>) acquires State {
        let state = borrow_global_mut<State>(@token_bridge);
        let inner_map = table::borrow_mut(&mut state.wrappedAssets, tokenChainId);
        if (table::contains(inner_map, tokenAddress)){
            table::remove(inner_map, tokenAddress);
        };
        table::add(inner_map, tokenAddress, wrapper);
        let isWrappedAsset = &mut state.isWrappedAsset;
        if (table::contains(isWrappedAsset, wrapper)){
            table::remove(isWrappedAsset, wrapper);
        };
        table::add(isWrappedAsset, wrapper, true);
    }

    public entry fun setNativeAsset(tokenAddress: vector<u8>, type_info: TypeInfo) acquires State {
        let state = borrow_global_mut<State>(@token_bridge);
        let native_assets = &mut state.nativeAssets;
        if (table::contains(native_assets, tokenAddress)){
            //TODO: throw error, because we should only be able to set native asset type info once?
            table::remove(native_assets, tokenAddress);
        };
        table::add(native_assets, tokenAddress, type_info);
        let isNativeAsset = &mut state.isNativeAsset;
        if (table::contains(isNativeAsset, tokenAddress)){
            table::remove(isNativeAsset, tokenAddress);
        };
        table::add(isNativeAsset, tokenAddress, true);
    }

    public entry fun setOutstandingBridged(token: vector<u8>, outstanding: U256) acquires State {
        let state = borrow_global_mut<State>(@token_bridge);
        let outstandingBridged = &mut state.outstandingBridged;
        if (table::contains(outstandingBridged, token)){
            table::remove(outstandingBridged, token);
        };
        table::add(outstandingBridged, token, outstanding);
    }

    public entry fun setFinality(finality: u8) acquires State{
        let state = borrow_global_mut<State>(@token_bridge);
        state.provider.finality = finality;
    }
}
