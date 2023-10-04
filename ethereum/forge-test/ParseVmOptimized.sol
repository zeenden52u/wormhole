// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../contracts/libraries/relayer/BytesParsing.sol";
import "../contracts/Structs.sol";

import "forge-std/Console.sol"; 

contract OptimizedParser {
    using BytesParsing for bytes;

    function checkPayloadId(
		bytes memory encoded,
		uint256 startOffset,
		uint8 expectedPayloadId
	) private pure returns (uint256 offset) {
		uint8 parsedPayloadId;
		(parsedPayloadId, offset) = encoded.asUint8Unchecked(startOffset);
        require(parsedPayloadId == expectedPayloadId, "invalid payload id");
	}

    function internalParseVMFast(bytes memory encodedVM) public view virtual returns (Structs.VM memory vm) {
        uint256 gasBefore = gasleft();
        vm = parseVMFast(encodedVM);
        uint256 gasAfter = gasleft();
        console.log("Gas cost before: %d", gasBefore - gasAfter);
    }

    function parseVMFast(bytes memory encodedVM) public pure virtual returns (Structs.VM memory vm) {
        uint256 offset = checkPayloadId(encodedVM, 0, 1);
        vm.version = 1;
        (vm.guardianSetIndex, offset) = encodedVM.asUint32Unchecked(offset);

        // Parse sigs. 
        uint256 signersLen;
        (signersLen, offset) = encodedVM.asUint8Unchecked(offset);

        vm.signatures = new Structs.Signature[](signersLen);
        for (uint i = 0; i < signersLen;) {
            (vm.signatures[i].guardianIndex, offset) = encodedVM.asUint8Unchecked(offset);
            (vm.signatures[i].r, offset) = encodedVM.asBytes32Unchecked(offset);
            (vm.signatures[i].s, offset) = encodedVM.asBytes32Unchecked(offset);
            (vm.signatures[i].v, offset) = encodedVM.asUint8Unchecked(offset);
            
            unchecked { 
                vm.signatures[i].v += 27;
                ++i; 
            }
        }

        bytes memory body;
        (body, ) = encodedVM.sliceUnchecked(offset, encodedVM.length - offset);
        vm.hash = keccak256(abi.encodePacked(keccak256(body)));

        // Parse the body
        (vm.timestamp, offset) = encodedVM.asUint32Unchecked(offset);
        (vm.nonce, offset) = encodedVM.asUint32Unchecked(offset);
        (vm.emitterChainId, offset) = encodedVM.asUint16Unchecked(offset);
        (vm.emitterAddress, offset) = encodedVM.asBytes32Unchecked(offset);
        (vm.sequence, offset) = encodedVM.asUint64Unchecked(offset);
        (vm.consistencyLevel, offset) = encodedVM.asUint8Unchecked(offset);
        (vm.payload, offset) = encodedVM.sliceUnchecked(offset, encodedVM.length - offset);

        require(encodedVM.length == offset, "invalid payload length");
    }
}