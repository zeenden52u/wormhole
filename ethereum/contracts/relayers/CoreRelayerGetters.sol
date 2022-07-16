// contracts/Getters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../interfaces/IWormhole.sol";
import "../interfaces/IGasOracle.sol";

import "./CoreRelayerState.sol";


abstract contract CoreRelayerGetters is CoreRelayerState {
    function governanceActionIsConsumed(bytes32 hash) public view returns (bool) {
        return _state.consumedGovernanceActions[hash];
    }

    function isInitialized(address impl) public view returns (bool) {
        return _state.initializedImplementations[impl];
    }

    function wormhole() public view returns (IWormhole) {
        return IWormhole(_state.wormhole);
    }

    function chainId() public view returns (uint16){
        return _state.provider.chainId;
    }

    function governanceChainId() public view returns (uint16){
        return _state.provider.governanceChainId;
    }

    function governanceContract() public view returns (bytes32){
        return _state.provider.governanceContract;
    }

    function registeredContract(uint16 chain) public view returns (bytes32){
        return _state.registeredContracts[chain];
    }

    function gasOracle() public view returns (IGasOracle){
        return IGasOracle(_state.gasOracle);
    }

    function isDeliveryCompleted(bytes32 hash) public view returns (bool) {
        return _state.completedDeliveries[hash];
    }

}
