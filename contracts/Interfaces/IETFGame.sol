// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

// Maybe this interface is not necesary
interface IETFGame {
    function ETFVaults(uint256 _ETFnumber) external view returns(address);
}