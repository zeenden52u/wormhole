// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "forge-std/Vm.sol";


type WeiPrice is uint256;
type GasPrice is uint256;
type Gas is uint256;
type Dollar is uint256;
// using {add as +} for Wei global;
// using {sub as -} for Wei global;
// using {lte as <=} for Wei global;
using {toDollars} for Wei global;
// using {toWei} for Gas global;
// using {WeiLibtoDollars} for Gas global;
// using {toGas} for Wei global;
// using {toWei} for Dollar global;

type Wei is uint256;

function lte(Wei a, Wei b) pure returns (bool) {
    return Wei.unwrap(a) <= Wei.unwrap(b);
}

function sub(Wei a, Wei b) pure returns (Wei) {
    return Wei.wrap(Wei.unwrap(a) - Wei.unwrap(b));
}

function add(Wei a, Wei b) pure returns (Wei) {
    return Wei.wrap(Wei.unwrap(a) + Wei.unwrap(b));
}

function toDollars(Wei w, WeiPrice price) pure returns (Dollar) {
    return Dollar.wrap(Wei.unwrap(w) * WeiPrice.unwrap(price));
}


function toWei(Gas w, GasPrice price) pure returns (Wei) {
  return Wei.wrap(Gas.unwrap(w) * GasPrice.unwrap(price));
}


contract TestNewTypes is Test {
  function testIt(Wei a, Wei b) public returns (Dollar) {
      vm.assume(Wei.unwrap(a) < type(uint256).max / 2);
      return a.toDollars(WeiPrice.wrap(2)); // Equivalent to add(a, b)
  }
}