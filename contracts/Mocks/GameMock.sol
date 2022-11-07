// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "../Game.sol";
import "hardhat/console.sol";

contract GameMock is Game {
  constructor(
    string memory name_,
    string memory symbol_,
    address _derbyTokenAddress,
    address _routerAddress,
    address _dao,
    address _guardian,
    address _controller
  ) Game(name_, symbol_, _derbyTokenAddress, _routerAddress, _dao, _guardian, _controller) {}

  function lockTokensToBasketTEST(uint256 _lockedTokenAmount) public {
    lockTokensToBasket(_lockedTokenAmount);
  }

  function unlockTokensFromBasketTEST(uint256 _basketId, uint256 _lockedTokenAmount) public {
    unlockTokensFromBasket(_basketId, _lockedTokenAmount);
  }

  function addToTotalRewardsTEST(uint256 _basketId) public {
    addToTotalRewards(_basketId);
  }

  function setDeltaAllocations(
    address _vault,
    uint256 _protocolNum,
    int256 _allocation
  ) external {
    IVault(_vault).setDeltaAllocations(_protocolNum, _allocation);
  }

  function setXChainRebalanceState(uint256 _vaultNumber, bool _state) external {
    isXChainRebalancing[_vaultNumber] = _state;
  }

  function triggerRedeemedRewardsVault(
    address _vault,
    address user,
    uint256 amount
  ) external {
    IVault(_vault).redeemRewardsGame(amount, user);
  }

  function upRebalancingPeriod(uint256 _vaultNumber) external {
    vaults[_vaultNumber].rebalancingPeriod++;
  }

  function getDeltaAllocationChainTEST(uint256 _ETFNumber, uint256 _chainId)
    external
    view
    returns (int256)
  {
    return getDeltaAllocationChain(_ETFNumber, _chainId);
  }

  function getDeltaAllocationProtocolTEST(
    uint256 _ETFNumber,
    uint256 _chainId,
    uint256 _protocolNum
  ) external view returns (int256) {
    return getDeltaAllocationProtocol(_ETFNumber, _chainId, _protocolNum);
  }

  function mockRewards(
    uint256 _vaultNumber,
    uint16 _chainId,
    int256[] memory _rewards
  ) external {
    uint256 rebalancingPeriod = vaults[_vaultNumber].rebalancingPeriod;

    for (uint256 i = 0; i < _rewards.length; i++) {
      int256 lastReward = getRewardsPerLockedToken(
        _vaultNumber,
        _chainId,
        rebalancingPeriod - 1,
        i
      );
      vaults[_vaultNumber].rewardPerLockedToken[_chainId][rebalancingPeriod][i] =
        lastReward +
        _rewards[i];
    }
  }

  function getRewardsPerLockedTokenTEST(
    uint256 _vaultNumber,
    uint16 _chainId,
    uint256 _rebalancingPeriod,
    uint256 _protocolId
  ) external view returns (int256) {
    return getRewardsPerLockedToken(_vaultNumber, _chainId, _rebalancingPeriod, _protocolId);
  }
}
