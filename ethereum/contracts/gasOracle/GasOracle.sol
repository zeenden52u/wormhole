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

    function getQuote(uint16 targetChain) public view returns (uint256 quote) {
        bytes32 myChainInfo = priceInfo(chainId());
        bytes32 targetChainInfo = priceInfo(targetChain);

        uint16 myNativeQuote = uint16(myChainInfo[0:15]);

        uint16 targetNativeQuote = uint16(targetChainInfo[0:15]);
        uint16 targetGasQuote = uint16(targetChainInfo[16:]);

        //Native Currency Quotes are in pennies, Gas Price quotes are in gwei.

        //  targetGwei     Penny        NativeCoin   NativeWei    TargetCoin    nativeWei
        // ------------ x  --------- x  ---------- x --------   x ---------  =  ----------
        //  targetGas      TargetCoin   Penny        NativeCoin   targetGwei    targetGas
        
        // targetGasQuote * targetNativeQuote * myNativeQuote^-1 * 10^18 * 10^-9

        //To avoid integer division truncation, we will divide by the inverse where we do not have the
        //applicable number.
                                //Item 1        //Item 2            //Item 4     
        // uint256 multiplicand = targetGasQuote * targetNativeQuote * (10 ** 18);
        //                   //Inverse of 3, inverse of 5
        // uint256 divisor = myNativeQuote * (10 ** 9);

        // quote = multiplicand / divisor;

        quote = (targetGasQuote * targetNativeQuote * 10 ** 9)/myNativeQuote;
    }
}