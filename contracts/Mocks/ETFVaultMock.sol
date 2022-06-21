// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../ETFVault.sol";
import "hardhat/console.sol";

// import "../libraries/ABDKMath64x64.sol";

contract ETFVaultMock is ETFVault { // is VaultToken

  mapping(uint256 => uint256) private players;

  event MinAmountOut(uint256 minAmountOut);

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    string memory _ETFname,
    uint256 _ETFnumber,
    address _governed,
    address _ETFGame, 
    address _controller, 
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
    _controller,
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

  function getPerformanceFee() external view returns(uint256) {
    return performanceFee;
  }

  function getETFGame() external view returns(address) {
    return ETFgame;
  }

  function getETFnumber() external view returns(uint256) {
    return ETFnumber;
  }

  function balanceSharesTEST(uint256 _protocolNum, address _address) external view returns(uint256) {
    return controller.balance(ETFnumber, _protocolNum, _address);
  }
  
  function setCurrentAllocation(uint256 _protocolNum, int256 _allocation) external {
    currentAllocations[_protocolNum] = _allocation;
  }

  function resetDeltaAllocations(uint256 _protocolNum) external {
    deltaAllocations[_protocolNum] = 0;
  }

  function clearCurrencyBalance(uint256 _balance) external {
    vaultCurrency.transfer(governed, _balance);
  }

  function swapTokensMultiTest(uint256 _amount, address _tokenIn, address _tokenOut) external returns(uint256) {
    return Swap.swapTokensMulti(
      _amount, 
      _tokenIn, 
      _tokenOut, 
      controller.uniswapRouter(),
      controller.uniswapQuoter(),
      controller.uniswapPoolFee()
    );
  }

  function swapTokensSingle(uint256 _amount, address _tokenIn, address _tokenOut) external returns(uint256) {
    return Swap.swapTokensSingle(
      _amount, 
      _tokenIn, 
      _tokenOut,
      controller.uniswapRouter(),
      controller.uniswapQuoter(),
      controller.uniswapPoolFee()
    );
  }

  function swapMinAmountOutMultiTest(uint256 _amount, address _tokenIn, address _tokenOut) external {
    uint256 minAmountOut = Swap.amountOutMultiSwap(
      _amount,
      _tokenIn,
      _tokenOut,
      controller.uniswapQuoter(),
      controller.uniswapPoolFee()
    );

    emit MinAmountOut(minAmountOut);
  }

  function curveSwapTest(uint256 _amount, address _tokenIn, address _tokenOut) external {
    Swap.swapStableCoins(
      _amount, 
      _tokenIn, 
      _tokenOut,
      uScale,
      1000000000000000000,
      controller.curveIndex(_tokenIn),
      controller.curveIndex(_tokenOut),
      controller.curve3Pool(),
      controller.curve3PoolFee()
    );
  }

  function testLargeGameplayerSet(uint256 _amountOfPlayers) public {
    for (uint256 i = 0; i < _amountOfPlayers; i++){
      uint256 exchangeRate = exchangeRate();
      players[i] = exchangeRate;
    }
  }

  function setVaultState(uint256 _state) external {
    if (_state == 0) state = State.WaitingForController;
    if (_state == 1) state = State.SendingFundsXChain;
    if (_state == 2) state = State.WaitingForFunds;
    if (_state == 3) state = State.RebalanceVault;
  }

  // function testFormulaWithNRoot(uint256 _g, uint256 _n) public view returns(int128) {
  //   int128 g_casted = ABDKMath64x64.fromUInt(_g);
  //   int128 n_casted = ABDKMath64x64.fromUInt(_n);
  //   int128 log2 = ABDKMath64x64.log_2(g_casted);
  //   int128 endResult = ABDKMath64x64.exp_2(log2 / n_casted);
  //   return endResult;
  // }
}