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
        GasOracleStructs.PriceInfo memory myChainInfo = priceInfo(chainId());
        GasOracleStructs.PriceInfo memory targetChainInfo = priceInfo(targetChain);

        uint128 myNativeQuote = myChainInfo.native;

        uint128 targetNativeQuote = targetChainInfo.native;
        uint128 targetGasQuote = targetChainInfo.gas;

        
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

    /// @title Execute a price change governance message
    /// @dev A chain having multiple updates inside one message is considered to be undefined behavior.
    function changePrices(bytes memory encodedVM) onlyApprovedUpdater public {
        GasOracleStructs.ChainPriceInfo[] memory vm = parseChangePricesMessage(encodedVM);

        setPriceInfos(vm);
    }
    
    function parseChangePricesMessage(bytes memory encoded) internal pure returns (GasOracleStructs.ChainPriceInfo[] memory priceInfos) {
        uint index = 0;

        bytes32 moduleName = encoded.toBytes32(index);
        index += 32;
        require(moduleName == module, "invalid price change message: wrong module");

        uint16 version = encoded.toUint16(index);
        index += 2;
        require(version == 1, "invalid price change message: invalid version number");

        uint16 arrayLength = encoded.toUint16(index);
        index += 2;
        require(arrayLength > 0, "invalid price change message: arrayLength not greater than 0");
        
        priceInfos = new GasOracleStructs.ChainPriceInfo[](arrayLength);

        while(arrayLength > 0) {
            uint16 chain = encoded.toUint16(index);
            index += 2;
            uint128 native = encoded.toUint128(index);
            index += 16;
            uint128 gas = encoded.toUint128(index);
            index += 16;

            priceInfos[arrayLength-1] = GasOracleStructs.ChainPriceInfo(chain, GasOracleStructs.PriceInfo(native, gas));
            arrayLength--;
        }

        require(index == encoded.length, "Message length not equal to stated length");
    }

    function  (bytes memory encodedVM) internal view returns (GasOracleStructs.SignerUpdate memory parsedVM) {

    }

    // Access control
    modifier onlyApprovedUpdater {
        require(msg.sender == approvedUpdater(), "Not approved updater");
        _;
    }

    function changeApprovedUpdater(bytes memory encodedVM) public {
        (IWormhole.VM memory vm, bool valid, string memory reason) = verifyGovernanceVM(encodedVM);
        require(valid, reason);

        setGovernanceActionConsumed(vm.hash);

        GasOracleStructs.SignerUpdate memory signerUpdate = parse(vm.payload);

        //TODO check module & version, potentially more

        setApprovedUpdater(address(uint160(uint256(signerUpdate.approvedUpdater))));
    }


}
