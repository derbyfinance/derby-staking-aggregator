// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IETFGame {
    function ETFVaults(uint256 _ETFnumber) external view returns(address);
    function basketUnredeemedRewards(uint256 _basketId) external view returns(int256);
    function basketRedeemedRewards(uint256 _basketId) external view returns(int256);
}