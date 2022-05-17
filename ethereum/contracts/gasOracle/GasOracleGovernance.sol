// contracts/Oracle.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

import "../libraries/external/BytesLib.sol";

import "./GasOracleGetters.sol";
import "./GasOracleSetters.sol";
import "./GasOracleStructs.sol";

import "../interfaces/IWormhole.sol";

abstract contract GasOracleGovernance is GasOracleGetters, GasOracleSetters, ERC1967Upgrade {
    using BytesLib for bytes;

    //TODO "GasOracle" (left padded)
    bytes32 constant module = 0x000000000000000000000000000000000000000000;

    // Execute a UpgradeContract governance message
    function upgrade(bytes memory encodedVM) public {
        (IWormhole.VM memory vm, bool valid, string memory reason) = verifyGovernanceVM(encodedVM);
        require(valid, reason);

        setGovernanceActionConsumed(vm.hash);

        GasOracleStructs.UpgradeContract memory implementation = parseUpgrade(vm.payload);

        require(GasOracleStructs.ChainId.unwrap(implementation.chainId) == GasOracleStructs.ChainId.unwrap(chainId()), "wrong chain id");

        upgradeImplementation(address(uint160(uint256(implementation.newContract))));
    }

    function verifyGovernanceVM(bytes memory encodedVM) internal view returns (IWormhole.VM memory parsedVM, bool isValid, string memory invalidReason){
        (IWormhole.VM memory vm, bool valid, string memory reason) = wormhole().parseAndVerifyVM(encodedVM);

        if (!valid) {
            return (vm, valid, reason);
        }

        if (vm.emitterChainId != GasOracleStructs.ChainId.unwrap(governanceChainId())) {
            return (vm, false, "wrong governance chain");
        }
        if (vm.emitterAddress != governanceContract()) {
            return (vm, false, "wrong governance contract");
        }

        if (governanceActionIsConsumed(vm.hash)) {
            return (vm, false, "governance action already consumed");
        }

        return (vm, true, "");
    }

    event ContractUpgraded(address indexed oldContract, address indexed newContract);

    function upgradeImplementation(address newImplementation) internal {
        address currentImplementation = _getImplementation();

        _upgradeTo(newImplementation);

        // Call initialize function of the new implementation
        (bool success, bytes memory reason) = newImplementation.delegatecall(abi.encodeWithSignature("initialize()"));

        require(success, string(reason));

        emit ContractUpgraded(currentImplementation, newImplementation);
    }


    function parseUpgrade(bytes memory encoded) public pure returns (GasOracleStructs.UpgradeContract memory chain) {
        uint index = 0;

        // governance header

        chain.module = encoded.toBytes32(index);
        index += 32;
        require(chain.module == module, "invalid UpgradeContract: wrong module");

        chain.action = encoded.toUint8(index);
        index += 1;
        require(chain.action == 2, "invalid UpgradeContract: wrong action");

        chain.chainId = GasOracleStructs.ChainId.wrap(encoded.toUint16(index));
        index += 2;

        // payload

        chain.newContract = encoded.toBytes32(index);
        index += 32;

        require(encoded.length == index, "invalid UpgradeContract: wrong length");
    }
}
