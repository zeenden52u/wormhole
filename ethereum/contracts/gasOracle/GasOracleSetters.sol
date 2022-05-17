// contracts/Setters.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./GasOracleState.sol";
import "./GasOracleStructs.sol";

abstract contract GasOracleSetters is GasOracleState {
    function setInitialized(address implementatiom) internal {
        _state.initializedImplementations[implementatiom] = true;
    }

    function setGovernanceActionConsumed(bytes32 hash) internal {
        _state.consumedGovernanceActions[hash] = true;
    }

    function setChainId(GasOracleStructs.ChainId chainId) internal {
        _state.provider.chainId = chainId;
    }

    function setGovernanceChainId(GasOracleStructs.ChainId chainId) internal {
        _state.provider.governanceChainId = chainId;
    }

    function setGovernanceContract(bytes32 governanceContract) internal {
        _state.provider.governanceContract = governanceContract;
    }

    function setWormhole(address wh) internal {
        _state.wormhole = payable(wh);
    }

    function setApprovedUpdater(address updater) internal {
        _state.approvedUpdater = updater;
    }
}
