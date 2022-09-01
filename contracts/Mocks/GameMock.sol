// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../Game.sol";
import "hardhat/console.sol";

contract GameMock is Game {
    constructor(string memory name_, 
        string memory symbol_, 
        address _derbyTokenAddress, 
        address _routerAddress,
        address _governed,
        address _controller
    ) Game (
        name_, 
        symbol_,
        _derbyTokenAddress,
        _routerAddress,
        _governed,
        _controller
    ) {}

    function lockTokensToBasketTEST(uint256 _lockedTokenAmount) public {
        lockTokensToBasket(_lockedTokenAmount);
    }

    function unlockTokensFromBasketTEST( uint256 _lockedTokenAmount) public {
        unlockTokensFromBasket(_lockedTokenAmount);
    }

    function addToTotalRewardsTEST(uint256 _basketId) public {
        addToTotalRewards(_basketId);
    } 

    function setDeltaAllocations(address _vault, uint256 _protocolNum, int256 _allocation) external {
        IVault(_vault).setDeltaAllocations(_protocolNum, _allocation);
    }

    function triggerRedeemedRewardsVault(address _vault, address user, uint256 amount) external {
        IVault(_vault).redeemRewards(user, amount);
    }

    function getDeltaAllocationChainTEST(
        uint256 _ETFNumber, 
        uint256 _chainId 
    ) external view returns(int256) {
        return getDeltaAllocationChain(_ETFNumber, _chainId);
    }

    function getDeltaAllocationProtocolTEST(
        uint256 _ETFNumber, 
        uint256 _chainId,
        uint256 _protocolNum
    ) external view returns(int256) {
        return getDeltaAllocationProtocol(_ETFNumber, _chainId, _protocolNum);
    }

    function setRewardsPerLockedTokenTEST(
      uint256 _vaultNumber, 
      uint16 _chainId, 
      uint256 _rebalancingPeriod, 
      uint256 _protocolId,
      int256 _reward
    ) external {
      vaults[_vaultNumber].rewardPerLockedToken[_chainId][_rebalancingPeriod][_protocolId] = _reward;
    }

    function getRewardsPerLockedTokenTEST(
      uint256 _vaultNumber, 
      uint16 _chainId, 
      uint256 _rebalancingPeriod, 
      uint256 _protocolId
    ) external view returns(int256) {
      return getRewardsPerLockedToken(_vaultNumber, _chainId, _rebalancingPeriod, _protocolId);
    }
}