// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./GasOracleStructs.sol";

abstract contract GasOracleStorage {
    struct Provider {
        uint16 chainId;
        uint16 governanceChainId;
        bytes32 governanceContract;
    }

    struct State {
        address payable wormhole;

        Provider provider;

        // Mapping of consumed governance actions
        mapping(bytes32 => bool) consumedGovernanceActions;

        // Mapping of initialized implementations
        mapping(address => bool) initializedImplementations;

        //The public key of the address allowed to update price infos
        bytes32 approvedUpdater;

        //Key: wormhole chain ID. Value: 16 bits USD quote of native currency, 16 bits price of gas unit
        mapping(uint16 => bytes32) priceInfos;
        
    }
}

abstract contract GasOracleState {
    GasOracleStorage.State _state;
}
