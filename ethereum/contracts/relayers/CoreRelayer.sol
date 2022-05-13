// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";

import "./CoreRelayerGetters.sol";
import "./CoreRelayerSetters.sol";
import "./CoreRelayerStructs.sol";
import "./CoreRelayerGovernance.sol";


abstract contract CoreRelayer is CoreRelayerGovernance {
    using BytesLib for bytes;

}