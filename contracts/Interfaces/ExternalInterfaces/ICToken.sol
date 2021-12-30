// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

interface ICToken {
    function balanceOf(address owner) external view returns (uint);

    function mint(uint) external returns (uint);

    function exchangeRateStored() external view returns (uint);

    function redeem(uint _amount) external returns (uint);
}