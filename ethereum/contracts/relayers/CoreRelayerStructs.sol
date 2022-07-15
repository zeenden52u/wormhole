// contracts/Structs.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

abstract contract CoreRelayerStructs {
    

    struct UpgradeContract {
        // Governance Header
        // module: "CoreRelayer" left-padded
        bytes32 module;
        // governance action: 2
        uint8 action;
        // governance paket chain id
        uint16 chainId;

        // Address of the new contract
        bytes32 newContract;
    }

    struct DeliveryInstructions {
        uint16 toChain;
        bytes32 toAddress;

        uint32 nonce;
        bytes relayParameters;
    }

    struct EVMDeliveryInstruction {
        uint8 payloadId;
        uint16 toChain;
        bytes32 toAddress;
        uint256 fee;
        uint16 gasLimit;
    }

    struct ReDeliveryInstructions {

        bytes32 batchHash; //Hash of the batch VAA to re-deliver
        uint16 deliveryVaaIndex; //Index inside the batch of the delivery VAA.

        bytes relayParameters; //New relay parameters to deliver with
    }

    struct DeliveryStatus {
        uint8 payloadId; //2
    }
}
