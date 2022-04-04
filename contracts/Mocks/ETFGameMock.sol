// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../ETFGame.sol";
import "hardhat/console.sol";

contract ETFGameMock is ETFGame {
    constructor(address _xaverTokenAddress, address _governed) ETFGame(
        xaverTokenAddress = _xaverTokenAddress,
        governed = _governed
    ){}

    function lockTokensToBasketTEST(address _user, uint256 _basketId, uint256 _lockedTokenAmount) public {
        lockTokensToBasket(_user, _basketId, _lockedTokenAmount);
    }

    function unlockTokensFromBasketTEST(address _user, uint256 _basketId, uint256 _lockedTokenAmount) public {
        unlockTokensFromBasket(_user, _basketId, _lockedTokenAmount);
    }
}