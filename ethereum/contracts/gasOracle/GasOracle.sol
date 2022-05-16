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

    //Returns the price of one unit of gas on the wormhole targetChain, denominated in this chain's wei.
    function getQuote(uint16 targetChain) public view returns (uint256 quote) {
        bytes32 myChainInfo = priceInfo(chainId());
        bytes32 targetChainInfo = priceInfo(targetChain);

        uint128 myNativeQuote = uint128(myChainInfo[0:15]);

        uint128 targetNativeQuote = uint128(targetChainInfo[0:15]);
        uint128 targetGasQuote = uint128(targetChainInfo[16:]);

        
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

    // Execute a price change governance message
    function changePrices(bytes memory encodedVM) public {
        (PriceUpdate memory vm, bool valid, string memory reason) = verifyChangePricesVM(encodedVM);
        require(valid, reason);

        setChangePricesActionConsumed(vm.hash);

        //TODO this
    }
    
    function changeApprovedUpdater(bytes memory encodedVM){
        (IWormhole.VM memory vm, bool valid, string memory reason) = verifyGovernanceVM(encodedVM);
        require(valid, reason);

        setGovernanceActionConsumed(vm.hash);

        GasOracleStructs.SignerUpdate memory signerUpdate = parse(vm.payload);

        //TODO check module & version, potentially more

        setApprovedUpdater(signerUpdate.approvedUpdater);
    }

    function verifyChangePricesVM(bytes memory encodedVM) internal view returns (PriceUpdate memory parsedVM, bool isValid, string memory invalidReason) {
        //TODO this
    }


}