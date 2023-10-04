// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../contracts/libraries/external/BytesLib.sol";
import "../contracts/Structs.sol";

import "forge-std/Console.sol";

contract Parser {
    using BytesLib for bytes;

    function internalParseVMSlow(bytes memory encodedVM) public view virtual returns (Structs.VM memory vm) {
        uint256 gasBefore = gasleft();
        vm = parseVMSlow(encodedVM);
        uint256 gasAfter = gasleft();
        console.log("Gas cost before: %d", gasBefore - gasAfter);
    }

    function parseVMSlow(bytes memory encodedVM) public pure virtual returns (Structs.VM memory vm) {
        uint index = 0;

        vm.version = encodedVM.toUint8(index);
        index += 1;
        // SECURITY: Note that currently the VM.version is not part of the hash 
        // and for reasons described below it cannot be made part of the hash. 
        // This means that this field's integrity is not protected and cannot be trusted. 
        // This is not a problem today since there is only one accepted version, but it 
        // could be a problem if we wanted to allow other versions in the future. 
        require(vm.version == 1, "VM version incompatible"); 

        vm.guardianSetIndex = encodedVM.toUint32(index);
        index += 4;

        // Parse Signatures
        uint256 signersLen = encodedVM.toUint8(index);
        index += 1;
        vm.signatures = new Structs.Signature[](signersLen);
        for (uint i = 0; i < signersLen; i++) {
            vm.signatures[i].guardianIndex = encodedVM.toUint8(index);
            index += 1;

            vm.signatures[i].r = encodedVM.toBytes32(index);
            index += 32;
            vm.signatures[i].s = encodedVM.toBytes32(index);
            index += 32;
            vm.signatures[i].v = encodedVM.toUint8(index) + 27;
            index += 1;
        }

        /*
        Hash the body

        SECURITY: Do not change the way the hash of a VM is computed! 
        Changing it could result into two different hashes for the same observation. 
        But xDapps rely on the hash of an observation for replay protection.
        */
        bytes memory body = encodedVM.slice(index, encodedVM.length - index);
        vm.hash = keccak256(abi.encodePacked(keccak256(body)));

        // Parse the body
        vm.timestamp = encodedVM.toUint32(index);
        index += 4;

        vm.nonce = encodedVM.toUint32(index);
        index += 4;

        vm.emitterChainId = encodedVM.toUint16(index);
        index += 2;

        vm.emitterAddress = encodedVM.toBytes32(index);
        index += 32;

        vm.sequence = encodedVM.toUint64(index);
        index += 8;

        vm.consistencyLevel = encodedVM.toUint8(index);
        index += 1;

        vm.payload = encodedVM.slice(index, encodedVM.length - index);
    }
}