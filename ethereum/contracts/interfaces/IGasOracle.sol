// contracts/Messages.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../gasOracle/GasOracleStructs.sol";

interface IGasOracle  {
    
    //Returns the price of one unit of gas on the wormhole targetChain, denominated in this chain's wei.
    function getQuote(uint16 targetChain) external view returns (uint256 quote);

    function changePrices(bytes memory encodedVM)  external ;

    function changeApprovedUpdater(bytes memory encodedVM) external ;

}
