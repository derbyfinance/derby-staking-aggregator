// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IETFVault {
  function swapTokens(uint256 _amountIn, address _tokenIn) external returns(uint256);
  function rebalancingPeriod() external view returns(uint256);
  function price() external view returns(uint256);
  function setDeltaAllocations(uint256 _protocolNum, int256 _allocation) external;
  function historicalPrices(uint256 _rebalancingPeriod, uint256 _protocolNum) external view returns(uint256);
  function cummulativeUnderlying(uint256) external view returns(uint256);
  function cummulativeLockedTokens(uint256) external view returns(int256);
}