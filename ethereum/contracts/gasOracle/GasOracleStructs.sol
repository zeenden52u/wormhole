// contracts/Structs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

library GasOracleStructs {

    
    struct UpgradeContract {
        // Governance Header
        // module: "GasOracle" left-padded
        bytes32 module;
        // governance action: 2
        uint8 action;
        // governance paket chain id
        uint16 chainId;
        // Address of the new contract
        bytes32 newContract;
    }

    struct PriceInfo {
        uint128 native;
        uint128 gas;
    }

    struct ChainPriceInfo {
        uint16 chain;
        PriceInfo priceInfo;
    }

    struct PriceUpdate {
        // Governance Header
        // module: "GasOracle" left-padded
        bytes32 module ;
        uint16 version;

        ChainPriceInfo[] priceInfos;
    }

    struct SignerUpdate {
        // module: "GasOracle" left-padded
        bytes32 module ;
        uint16 version;

        //TODO how best to store this
        bytes32  approvedUpdater;
    }
}
