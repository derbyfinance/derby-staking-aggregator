// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../ETFVault.sol";
import "hardhat/console.sol";

contract ETFVaultMock is ETFVault { // is VaultToken

  mapping(uint256 => uint256) private players;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    string memory _ETFname,
    uint256 _ETFnumber,
    address _governed,
    address _ETFGame, 
    address _router, 
    address _vaultCurrency,
    uint256 _uScale,
    uint256 _gasFeeLiquidity
  ) ETFVault(
    _name,
    _symbol,
    _decimals,
    _ETFname,
    _ETFnumber,
    _governed,
    _ETFGame,
    _router,
    _vaultCurrency,
    _uScale,
    _gasFeeLiquidity
  ) {}

  function getAllocationTEST(uint256 _protocolNum) external view returns(int256) {
    return currentAllocations[_protocolNum];
  }

  function getDeltaAllocationTEST(uint256 _protocolNum) external view returns(int256) {
    return deltaAllocations[_protocolNum];
  }

  function getMarginScale() external view returns(int256) {
    return marginScale;
  }

  function getLiquidityPerc() external view returns(uint256) {
    return liquidityPerc;
  }

  function setCurrentAllocation(uint256 _protocolNum, int256 _allocation) external {
    currentAllocations[_protocolNum] = _allocation;
  }

  function clearCurrencyBalance(uint256 _balance) external {
    vaultCurrency.transfer(governed, _balance);
  }

  function swapTokensMultiTest(uint256 _amount, address _tokenIn, address _tokenOut) external returns(uint256) {
    return Swap.swapTokensMulti(
      _amount, 
      _tokenIn, 
      _tokenOut, 
      router.uniswapRouter(), 
      router.uniswapPoolFee()
    );
  }

  function minAmountOutTest(uint256 _amount, address _tokenIn, address _tokenOut) external view returns(uint256) {
    return Swap.getPoolAmountOut(
      _amount, 
      _tokenIn, 
      _tokenOut, 
      router.uniswapFactory(), 
      router.uniswapPoolFee(),
      0
    );
  }

  function curveSwapTest(uint256 _amount, address _tokenIn, address _tokenOut) external {
    Swap.swapStableCoins(
      _amount, 
      _tokenIn, 
      _tokenOut,
      uScale,
      1000000000000000000,
      router.curveIndex(_tokenIn),
      router.curveIndex(_tokenOut),
      router.curve3Pool(),
      router.curve3PoolFee()
    );
  }

  function testLargeGameplayerSet(uint256 _amountOfPlayers) public {
    for (uint256 i = 0; i < _amountOfPlayers; i++){
      uint256 exchangeRate = exchangeRate();
      players[i] = exchangeRate;
    }
  }


}