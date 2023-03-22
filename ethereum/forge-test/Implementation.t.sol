// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../contracts/Implementation.sol";
import "forge-std/Test.sol";

contract TestImplementation is Implementation, Test {
    function testSeqReturn(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) public {
        setChainId(2);
        require(chainId() == 2,"expected chainId 2");
        uint64 sequence = publishMessage(nonce, payload, consistencyLevel);
        require(sequence == 0, "expected sequence 0");
        sequence = publishMessage(nonce, payload, consistencyLevel);
        require(sequence == 1, "expected sequence 1");
    }

    function testHashReturn(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) public {
        setChainId(2);
        require(chainId() == 2,"expected chainId 2");
        address emitter = 0x0290FB167208Af455bB137780163b7B7a9a10C16;
        require(this.nextSequence(emitter) == 0, "expected nextSequence 0");
        vm.prank(emitter);
        bytes32 vmHash = this.publishMessageRetHash(nonce, payload, consistencyLevel);
        require(this.nextSequence(emitter) == 1, "expected nextSequence 1");
        uint64 expectedSequence = 0;
        bytes memory expectedBody = abi.encodePacked(
            block.timestamp,
            nonce,
            chainId(),
            bytes32(uint256(uint160(emitter))),
            expectedSequence,
            consistencyLevel,
            payload
        );
        require(vmHash == keccak256(abi.encodePacked(keccak256(expectedBody))), "expected hash 0");
        vm.prank(emitter);
        vmHash = this.publishMessageRetHash(nonce, payload, consistencyLevel);
        require(this.nextSequence(emitter) == 2, "expected nextSequence 2");
        expectedSequence = 1;
        expectedBody = abi.encodePacked(
            block.timestamp,
            nonce,
            chainId(),
            bytes32(uint256(uint160(emitter))),
            expectedSequence,
            consistencyLevel,
            payload
        );
        require(vmHash == keccak256(abi.encodePacked(keccak256(expectedBody))), "expected hash 0");
    }
}
