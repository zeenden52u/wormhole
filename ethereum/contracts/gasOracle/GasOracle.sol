// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../libraries/external/BytesLib.sol";

import "./GasOracleGetters.sol";
import "./GasOracleSetters.sol";
import "./GasOracleStructs.sol";
import "./GasOracleGovernance.sol";


abstract contract GasOracle is GasOracleGovernance {
    using BytesLib for bytes;

    //core logic goes here
}