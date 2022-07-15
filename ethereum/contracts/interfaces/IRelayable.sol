// contracts/Messages.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../relayers/CoreRelayer.sol";

interface ICoreRelayer is CoreRelayerStructs {
    function receiveMessage(bytes[] encodedVMs) external;

}
