// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IETFVault {
  function swapTokens(uint256 _amountIn, address _tokenIn) external returns(uint256);
  function rebalancingPeriod() external view returns(uint256);
}