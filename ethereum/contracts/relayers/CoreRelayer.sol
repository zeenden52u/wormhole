// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";

import "./CoreRelayerGetters.sol";
import "./CoreRelayerSetters.sol";
import "./CoreRelayerStructs.sol";
import "./CoreRelayerGovernance.sol";
import "../interfaces/IRelayable.sol";


abstract contract CoreRelayer is CoreRelayerGovernance {
    using BytesLib for bytes;

    function requestDelivery(DeliveryInstructions instructions) public payable returns (uint64 sequence) {
        uint wormholeFee = wormhole().messageFee();
        uint evmGasOverhead = 0; //TODO move onto state

        //First, make sure the relayer params are properly formatted, and have a sufficient fee
        if(getVMType(instructions.targetChain) == 1 ){
            //EVM relayer parameters only have a gas limit in them.
            require(instructions.relayParameters.length == 8, "Incorrect relayer parameters length");
            uint64 gasLimit = instructions.relayParameters.toUint64(0); //0th index
            require(gasLimit > 0, "invalid gas limit in relay parameters"); 

            //check gas oracle calc requisite fee
            uint256 minimumFee = gasOracle().getQuote(instructions.targetChain) * (gasLimit  + evmGasOverhead) + wormholeFee;
            require(minimumFee <= msg.value, "Insufficient fee specified in msg.value");
        }

        //compose delivery message
        bytes memory encoded = encodeDelivery(instructions, msg.value - wormholeFee);
        //emit delivery message
        sequence = wormhole().publishMessage{value: wormholeFee}(
            instructions.nonce,
            encoded,
            15 //TODO figure out how to best specify finality
        );
    }

    function requestRedelivery(ReDeliveryInstructions instructions) public payable returns (uint64 sequence) {
    }

    function acceptDelivery(bytes memory encodedVM, uint16 deliveryVaaIndex) public {
        //Verify the batch VAA
        bytes[] vms = wormhole().verifyVM3(encodedVM);

        //Grab target index
        bytes targetVM = vms[deliveryVaaIndex];

        //parse vm to vaa
        Structs.Observation vaa = parseAndVerifyVAA(targetVM);

        //Make sure the emitter contract is in the relayer network
        bytes32 knownEmitter = getRegisteredContract(vaa.emitterChainId);
        require(knownEmitter != 0, "Originating chain does not have a registered relayer contract.");
        require(knownEmitter == vaa.emitterAddress, "Delivery VAA does not originate from a trusted contract.");

        //parse the VAA content
        EVMDeliveryInstruction deliveryInstruction = decodeDelivery(vm.payload);

        //Make sure this chain is the destination
        require(chainId() == deliveryInstruction.toChain, "The delivery VAA is not for this chain.");

        //Make sure this VAA has not already been delivered
        require(isDeliveryCompleted(targetVM.hash) == false, "Specified delivery VAA has already been delivered.");

        //Mark this VAA as delivered, are other re-entrancy guards needed?
        markAsDelivered(targetVM.hash);

        //Final step, process the delivery
        processDelivery(instructions, vms);
    }

    function processDelivery(EVMDeliveryInstructions instructions, bytes[] vms) internal returns (bool result) {
        address untrustedTargetContract = hexToNative(instructions.toAddress);

        result = untrustedTargetContract.call{value:0, gas:instructions.gasLimit}(abi.encodeWithSignature("receiveMessage(bytes[])", vms));
        
        //increment rewards for the relayer
        incrementRelayerReward(getRewardsKey(msg.sender), instructions.fee);
    }

    //This function can be called by a relayer to receive a VAA for its rewards on other chains.
    function emitRelayerRewards() public returns (uint64 sequence) {

    }

    function formatParamsEVM(uint64 targetGasAmount) public view returns (bytes) {
        return targetGasAmount;
    }

    //Because the relayer params are different dependent on the VM, we regularly need to 
    //branch behavior based on which VM is being targetted
    function getVMType(uint16 chainId) internal pure returns (uint16) {
        return 1; //EVM
    }

    function encodeDelivery(DeliveryInstructions instructions, uint256 fee) internal pure returns (bytes memory encoded) {
        encoded = abi.encodePacked(
            1,
            instructions.toChain,
            instructions.toAddress,
            //instructions.nonce, //TODO remove?
            fee,
            instructions.relayParameters
        );
    }

    function decodeDelivery(bytes encoded) internal pure returns(EVMDeliveryInstruction instruction){
        uint256 index = 0;

        uint8 payloadV = encoded.toUint8(index);
        index += 1;
        require(payloadV == 1, "Tried to parse non-delivery VAA");

        uint16 toChain = encoded.toUint16(index);
        index += 2;

        bytes32 toAddress = encoded.toUint16(index);
        index += 32;

        uint256 fee = encoded.toUint256(index);
        index += 32;

        uint64 gasLimit = encoded.toUint64(index);
        index += 8;

        require(index == encoded.length, "Message length not equal to expected length");

        instruction = EVMDeliveryInstruction(1, toChain, toAddress, fee, gasLimit);
    }

    //TODO get this from whatever the common location should be
    function hexToNative(bytes32 hexAddress) internal pure returns (address) {
        return address(hexAddress[12:]); 
    }

    function getRewardsKey(address relayerWallet,  uint16 rewardChain) internal pure returns (bytes32 key) {
        key = bytes32(uint256(uint160(addr)));
        bytes32 bytesShim = bytes32(rewardChain) << 240;
        key[0] = bytesShim[0];
        key[1] = bytesShim[1];
    }
}