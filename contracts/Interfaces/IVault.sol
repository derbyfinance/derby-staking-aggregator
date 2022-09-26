// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IVault {
  function swapTokens(uint256 _amountIn, address _tokenIn) external returns(uint256);
  function rebalancingPeriod() external view returns(uint256);
  function price(uint256) external view returns(uint256);
  function setDeltaAllocations(uint256 _protocolNum, int256 _allocation) external;
  function historicalPrices(uint256 _rebalancingPeriod, uint256 _protocolNum) external view returns(uint256);
  function rewardPerLockedToken(uint256 _rebalancingPeriod, uint256 _protocolNum) external view returns(int256);
  function redeemRewards(address _user, uint256 _amount) external;
  function performanceFee() external view returns(uint256);
  function getTotalUnderlying() external view returns(uint256);
  function getTotalUnderlyingIncBalance() external view returns(uint256);
  function vaultCurrencyAddress() external view returns(address);
  function setXChainAllocation(uint256 _amountToSend, uint256 _exchangeRate) external;
  function setVaultState(uint256 _state) external;
  function receiveFunds() external;
  function receiveProtocolAllocations(int256[] memory _deltas) external;
}