// contracts/Structs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

library GasOracleStructs {

    type ChainId is uint16;
    
    struct UpgradeContract {
        // Governance Header
        // module: "GasOracle" left-padded
        bytes32 module;
        // governance action: 2
        uint8 action;
        // governance paket chain id
        ChainId chainId;
        // Address of the new contract
        bytes32 newContract;
    }

    struct PriceInfo {
        bytes16 native;
        bytes16 gas;
    }

    struct ChainPriceInfo {
        ChainId chain;
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
