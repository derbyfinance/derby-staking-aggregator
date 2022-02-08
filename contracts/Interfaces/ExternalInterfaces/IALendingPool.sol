// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IALendingPool {

  function deposit(
    address asset, 
    uint256 amount, 
    address onBehalfOf, 
    uint16 referralCode
    ) external;

  function withdraw(
    address asset, 
    uint256 amount, 
    address to
    ) external returns (uint256);

}