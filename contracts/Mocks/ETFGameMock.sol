// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../ETFGame.sol";
import "hardhat/console.sol";

contract ETFGameMock is ETFGame {
    constructor(string memory name_, 
        string memory symbol_, 
        address _xaverTokenAddress, 
        address _routerAddress,
        address _governed,
        address _controller
    ) ETFGame (
        name_, 
        symbol_,
        _xaverTokenAddress,
        _routerAddress,
        _governed,
        _controller
    ) {}

    function lockTokensToBasketTEST(address _user, uint256 _basketId, uint256 _lockedTokenAmount) public {
        lockTokensToBasket(_user, _basketId, _lockedTokenAmount);
    }

    function unlockTokensFromBasketTEST(address _user, uint256 _basketId, uint256 _lockedTokenAmount) public {
        unlockTokensFromBasket(_user, _basketId, _lockedTokenAmount);
    }

    function addToTotalRewardsTEST(uint256 _basketId) public {
        addToTotalRewards(_basketId);
    } 

    function setDeltaAllocations(address ETFVault, uint256 _protocolNum, int256 _allocation) external {
        IETFVault(ETFVault).setDeltaAllocations(_protocolNum, _allocation);
    }
}