// contracts/Getters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../interfaces/IWormhole.sol";

import "./GasOracleState.sol";
import "./GasOracleStructs.sol";

abstract contract GasOracleGetters is GasOracleState {
    function governanceActionIsConsumed(bytes32 hash) public view returns (bool) {
        return _state.consumedGovernanceActions[hash];
    }

    function isInitialized(address impl) public view returns (bool) {
        return _state.initializedImplementations[impl];
    }

    function wormhole() public view returns (IWormhole) {
        return IWormhole(_state.wormhole);
    }

    function chainId() public view returns (uint16) {
        return _state.provider.chainId;
    }

    function governanceChainId() public view returns (uint16) {
        return _state.provider.governanceChainId;
    }

    function governanceContract() public view returns (bytes32){
        return _state.provider.governanceContract;
    }

    function priceInfo(uint16 chain) public view returns (GasOracleStructs.PriceInfo memory) {
        return _state.priceInfos[chain];
    }

    function approvedUpdater() public view returns (address) {
        return _state.approvedUpdater;
    }

}
