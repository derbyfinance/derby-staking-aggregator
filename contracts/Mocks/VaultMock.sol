// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "../Vault.sol";

contract VaultMock is Vault {
  mapping(uint256 => uint256) private players;

  event MinAmountOut(uint256 minAmountOut);

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _vaultNumber,
    address _dao,
    address _controller,
    address _vaultCurrency,
    address _nativeToken,
    uint256 _minScale
  )
    Vault(
      _name,
      _symbol,
      _decimals,
      _vaultNumber,
      _dao,
      _controller,
      _vaultCurrency,
      _nativeToken,
      _minScale
    )
  {}

  function getAllocationTEST(uint256 _protocolNum) external view returns (uint256) {
    return currentAllocations[_protocolNum];
  }

  function getDeltaAllocationTEST(uint256 _protocolNum) external view returns (int256) {
    return deltaAllocations[_protocolNum];
  }

  function setDeltaAllocations(uint256 _protocolNum, int256 _allocation) external {
    return setDeltaAllocationsInt(_protocolNum, _allocation);
  }

  function setDeltaAllocationsReceivedTEST(bool _state) external {
    deltaAllocationsReceived = _state;
  }

  function setTotalAllocatedTokensTest(uint256 _tokens) external {
    totalAllocatedTokens = _tokens;
  }

  function getLastPriceTEST(uint256 _protocolId) external view returns (uint256) {
    return lastPrices[_protocolId];
  }

  function getWithdrawalAllowanceTEST(address _address) external view returns (uint256) {
    return userInfo[_address].withdrawalAllowance;
  }

  function getRewardAllowanceTEST(address _address) external view returns (uint256) {
    return userInfo[_address].rewardAllowance;
  }

  function getTotalWithdrawalRequestsTEST() external view returns (uint256) {
    return totalWithdrawalRequests;
  }

  function setTotalWithdrawalRequestsTEST(uint256 _requests) external {
    totalWithdrawalRequests = _requests;
  }

  function setExchangeRateTEST(uint256 _exchangeRate) external {
    exchangeRate = _exchangeRate;
  }

  function upRebalancingPeriodTEST() external {
    rebalancingPeriod++;
  }

  function setCurrentAllocation(uint256 _protocolNum, uint256 _allocation) external {
    currentAllocations[_protocolNum] = _allocation;
  }

  function resetDeltaAllocations(uint256 _protocolNum) external {
    deltaAllocations[_protocolNum] = 0;
  }

  function clearCurrencyBalance(uint256 _balance) external {
    vaultCurrency.transfer(getDao(), _balance);
  }

  function balanceSharesTEST(
    uint256 _protocolNum,
    address _address
  ) external view returns (uint256) {
    IController.ProtocolInfoS memory p = controller.getProtocolInfo(vaultNumber, _protocolNum);
    uint256 balance = IProvider(p.provider).balance(_address, p.LPToken);

    return balance;
  }

  function swapTokensMultiTest(
    uint256 _amount,
    uint256 _deadline,
    uint256 _minAmountOut,
    address _tokenIn,
    address _tokenOut,
    bool _rewardsSwap
  ) external returns (uint256) {
    return
      Swap.swapTokensMulti(
        Swap.SwapInOut(_amount, _deadline, _minAmountOut, nativeToken, _tokenIn, _tokenOut),
        controller.getUniswapParams(),
        _rewardsSwap
      );
  }

  function swapMinAmountOutMultiTest(
    uint256 _amount,
    uint256 _deadline,
    uint256 _minAmountOut,
    address _tokenIn,
    address _tokenOut
  ) external {
    uint256 minAmountOut = Swap.amountOutMultiSwap(
      Swap.SwapInOut(_amount, _deadline, _minAmountOut, nativeToken, _tokenIn, _tokenOut),
      controller.getUniswapQuoter(),
      controller.getUniswapPoolFee()
    );

    emit MinAmountOut(minAmountOut);
  }

  function testLargeGameplayerSet(uint256 _amountOfPlayers) public {
    for (uint256 i = 0; i < _amountOfPlayers; i++) {
      players[i] = exchangeRate;
    }
  }

  function storePriceAndRewardsTest(uint256 _protocolId) external {
    storePriceAndRewards(_protocolId);
  }

  function depositInProtocolTest(uint256 _protocolNum, uint256 _amount) external {
    return depositInProtocol(_protocolNum, _amount);
  }

  function withdrawFromProtocolTest(
    uint256 _protocolNum,
    uint256 _amount
  ) external returns (uint256) {
    return withdrawFromProtocol(_protocolNum, _amount);
  }

  function getTotalDepositRequestsTest() external view returns (uint256) {
    return totalDepositRequests;
  }

  function setSavedTotalUnderlyingTest(uint256 _amount) external {
    savedTotalUnderlying = _amount;
  }

  // function testFormulaWithNRoot(uint256 _g, uint256 _n) public view returns(int128) {
  //   int128 g_casted = ABDKMath64x64.fromUInt(_g);
  //   int128 n_casted = ABDKMath64x64.fromUInt(_n);
  //   int128 log2 = ABDKMath64x64.log_2(g_casted);
  //   int128 endResult = ABDKMath64x64.exp_2(log2 / n_casted);
  //   return endResult;
  // }
}
