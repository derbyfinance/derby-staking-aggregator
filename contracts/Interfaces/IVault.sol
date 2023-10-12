// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

interface IVault {
  function rebalancingPeriod() external view returns (uint256);

  function price(uint256) external view returns (uint256);

  function setDeltaAllocations(uint256 _protocolNum, int256 _allocation) external;

  function rewardPerLockedToken(
    uint256 _rebalancingPeriod,
    uint256 _protocolNum
  ) external view returns (int256);

  function performanceFee() external view returns (uint256);

  function receiveProtocolAllocations(int256[] memory _deltas) external;

  function decimals() external view returns (uint256);

  function redeemRewardsGame(uint256 _amount, address _user) external;
}
