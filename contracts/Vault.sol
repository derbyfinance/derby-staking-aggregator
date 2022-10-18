// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./Interfaces/IController.sol";
import "./Interfaces/IXProvider.sol";
import "./Interfaces/IXChainController.sol";

import "./VaultToken.sol";
import "./libraries/swap.sol";

import "hardhat/console.sol";

contract Vault is ReentrancyGuard {
  using SafeERC20 for IERC20;
  // name of the ETF e.g. yield_defi_usd_low (a yield token ETF in DeFi in UDS with low risk) or yield_defi_btc_high or exchange_stocks_usd_mid
  uint256 public vaultNumber;

  IERC20 public vaultCurrency;
  IController public controller;

  // state 0 Rebalance done and ready for xController to rebalance again
  // state 1 Allocation amount received and ready to send funds over to xController
  // state 2 Allocation amount 0 received => will receive funds from xController
  // state 3 Allocation amount sent or received and ready to rebalance the vault itself
  enum State {
    Idle,
    PushedUnderlying,
    SendingFundsXChain,
    WaitingForFunds,
    RebalanceVault,
    SendRewardsPerToken
  }
  State public state;

  bool public deltaAllocationsReceived;

  address public vaultCurrencyAddr;
  address public game;
  address public governed;
  address public xController;
  address public xProvider;

  uint256 public liquidityPerc = 10;
  uint256 public performanceFee = 10;
  uint256 public rebalancingPeriod = 1;
  uint256 public uScale;
  int256 public marginScale = 1E10; // 10000 USDC

  // UNIX timestamp
  uint256 public rebalanceInterval; // SHOULD BE REPLACED FOR REALISTIC NUMBER
  uint256 public lastTimeStamp;
  uint256 public gasFeeLiquidity;

  // total underlying of all protocols in vault, excluding vault balance
  uint256 public savedTotalUnderlying;

  // total number of allocated Derby tokens currently
  int256 public totalAllocatedTokens;
  // delta of the total number of Derby tokens allocated on next rebalancing
  int256 private deltaAllocatedTokens;

  // current allocations over the protocols
  mapping(uint256 => int256) internal currentAllocations;

  // delta of the portfolio on next rebalancing
  mapping(uint256 => int256) internal deltaAllocations;

  // historical reward per protocol per token, formula: TVL * yield * perfFee / totalLockedTokens
  // first index is rebalancing period, second index is protocol id.
  mapping(uint256 => mapping(uint256 => int256)) public rewardPerLockedToken;

  // historical prices, first index is rebalancing period, second index is protocol id.
  mapping(uint256 => mapping(uint256 => uint256)) public historicalPrices;

  event GasPaidRebalanceETF(uint256 gasInVaultCurrency);

  modifier onlyDao() {
    require(msg.sender == governed, "Vault: only DAO");
    _;
  }

  modifier returnGasFee() {
    uint256 gasStart = gasleft();
    _;
    uint256 gasUsed = gasStart - gasleft();
    // console.log("gasUsed %s", gasUsed);
    swapAndPayGasFee(gasUsed);
  }

  constructor(
    uint256 _vaultNumber,
    address _governed,
    address _game,
    address _controller,
    address _vaultCurrency,
    uint256 _uScale,
    uint256 _gasFeeLiquidity
  ) {
    controller = IController(_controller);
    vaultCurrency = IERC20(_vaultCurrency);
    vaultCurrencyAddr = _vaultCurrency;

    vaultNumber = _vaultNumber;

    governed = _governed;
    game = _game;
    uScale = _uScale;
    gasFeeLiquidity = _gasFeeLiquidity;
    lastTimeStamp = block.timestamp;
  }

  /// @notice Withdraw from protocols on shortage in Vault
  /// @dev Keeps on withdrawing until the Vault balance > _value
  /// @param _value The total value of vaultCurrency an user is trying to withdraw.
  /// @param _value The (value - current underlying value of this vault) is withdrawn from the underlying protocols.
  function pullFunds(uint256 _value) internal {
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      if (currentAllocations[i] == 0) continue;

      uint256 shortage = _value - getVaultBalance();
      uint256 balanceProtocol = balanceUnderlying(i);

      uint256 amountToWithdraw = shortage > balanceProtocol ? balanceProtocol : shortage;
      savedTotalUnderlying -= amountToWithdraw;

      withdrawFromProtocol(i, amountToWithdraw);

      if (_value <= getVaultBalance()) break;
    }
  }

  /// @notice Step 7 trigger, end; Vaults rebalance
  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev amountToProtocol = totalAmount * currentAllocation / totalAllocatedTokens
  /// @dev amountToDeposit = amountToProtocol - currentBalanceProtocol
  /// @dev if amountToDeposit < 0 => withdraw
  /// @dev Execute all withdrawals before deposits
  function rebalanceETF() external returnGasFee nonReentrant onlyDao {
    require(state == State.RebalanceVault, "Wrong state");
    require(deltaAllocationsReceived, "!Delta allocations");

    rebalancingPeriod++;

    claimTokens();
    settleDeltaAllocation();

    uint256 underlyingIncBalance = calcUnderlyingIncBalance();
    uint256[] memory protocolToDeposit = rebalanceCheckProtocols(underlyingIncBalance);

    executeDeposits(protocolToDeposit);
    setTotalUnderlying();

    if (getVaultBalance() < gasFeeLiquidity) pullFunds(gasFeeLiquidity);

    state = State.SendRewardsPerToken;
    deltaAllocationsReceived = false;
  }

  /// @notice Helper to return underlying balance plus totalUnderlying - liquidty for the vault
  /// @return underlying totalUnderlying - liquidityVault
  function calcUnderlyingIncBalance() internal view returns (uint256) {
    uint256 totalUnderlyingInclVaultBalance = savedTotalUnderlying + getVaultBalance();
    uint256 liquidityVault = (totalUnderlyingInclVaultBalance * liquidityPerc) / 100;
    return totalUnderlyingInclVaultBalance - liquidityVault;
  }

  /// @notice Adds deltaAllocatedTokens to totalAllocatedTokens
  function settleDeltaAllocation() internal {
    totalAllocatedTokens += deltaAllocatedTokens;
    deltaAllocatedTokens = 0;
  }

  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev Loops over all protocols in ETF, calculate new currentAllocation based on deltaAllocation
  /// @dev Also calculate the performance fee here. This is an amount, based on the current TVL (before the rebalance),
  /// @dev the performanceFee and difference between the current exchangeRate and the exchangeRate of the last rebalance of the vault.
  /// @param _newTotalUnderlying this will be the new total underlying: Totalunderlying = TotalUnderlyingInProtocols - BalanceVault
  /// @return uint256[] with amounts to deposit in protocols, the index being the protocol number.
  function rebalanceCheckProtocols(uint256 _newTotalUnderlying)
    internal
    returns (uint256[] memory)
  {
    uint256[] memory protocolToDeposit = new uint[](controller.latestProtocolId(vaultNumber));
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      bool isBlacklisted = controller.getProtocolBlacklist(vaultNumber, i);

      storePriceAndRewards(_newTotalUnderlying, i);

      if (deltaAllocations[i] == 0 || isBlacklisted) continue;

      setAllocation(i);

      int256 amountToProtocol = calcAmountToProtocol(_newTotalUnderlying, i);
      uint256 currentBalance = balanceUnderlying(i);

      int256 amountToDeposit = amountToProtocol - int(currentBalance);
      uint256 amountToWithdraw = amountToDeposit < 0 ? currentBalance - uint(amountToProtocol) : 0;

      if (amountToDeposit > marginScale) protocolToDeposit[i] = uint256(amountToDeposit);
      if (amountToWithdraw > uint(marginScale) || currentAllocations[i] == 0)
        withdrawFromProtocol(i, amountToWithdraw);
    }

    return protocolToDeposit;
  }

  /// @notice Calculates the amount to deposit or withdraw to protocol during a vault rebalance
  /// @param _totalUnderlying Totalunderlying = TotalUnderlyingInProtocols - BalanceVault
  /// @param _protocol Protocol id number
  /// @return amountToProtocol amount to deposit or withdraw to protocol
  function calcAmountToProtocol(uint256 _totalUnderlying, uint256 _protocol)
    internal
    view
    returns (int256 amountToProtocol)
  {
    if (totalAllocatedTokens == 0) amountToProtocol = 0;
    else
      amountToProtocol =
        (int(_totalUnderlying) * currentAllocations[_protocol]) /
        totalAllocatedTokens;
  }

  /// @notice Stores the historical price and the reward per rounded locked token, ignoring decimals.
  /// @dev formula yield protocol i at time t: y(it) = (P(it) - P(it-1)) / P(it-1).
  /// @dev formula rewardPerLockedToken for protocol i at time t: r(it) = y(it) * TVL(t) * perfFee(t) / totalLockedTokens(t)
  /// @dev later, when the total rewards are calculated for a game player we multiply this (r(it)) by the locked tokens on protocol i at time t
  /// @param _totalUnderlying Totalunderlying = TotalUnderlyingInProtocols - BalanceVault.
  /// @param _protocolId Protocol id number.
  function storePriceAndRewards(uint256 _totalUnderlying, uint256 _protocolId) internal {
    uint256 price = price(_protocolId);
    historicalPrices[rebalancingPeriod][_protocolId] = price;
    if (historicalPrices[rebalancingPeriod - 1][_protocolId] == 0) return;
    int256 priceDiff = int256(price - historicalPrices[rebalancingPeriod - 1][_protocolId]);
    int256 nominator = (int256(_totalUnderlying * performanceFee) * priceDiff);
    int256 totalAllocatedTokensRounded = totalAllocatedTokens / 1E18;
    int256 denominator = totalAllocatedTokensRounded *
      int256(historicalPrices[rebalancingPeriod - 1][_protocolId]) *
      100; // * 100 cause perfFee is in percentages
    if (totalAllocatedTokensRounded == 0) {
      rewardPerLockedToken[rebalancingPeriod][_protocolId] = 0;
    } else {
      rewardPerLockedToken[rebalancingPeriod][_protocolId] = nominator / denominator;
    }
  }

  /// @notice Creates array out of the rewardsPerLockedToken mapping to send to the game
  /// @return rewards Array with rewardsPerLockedToken of all protocols in vault => index matches protocolId
  function rewardsToArray() internal view returns (int256[] memory rewards) {
    uint256 latestId = controller.latestProtocolId(vaultNumber);
    rewards = new int[](latestId);

    for (uint256 i = 0; i < latestId; i++) {
      rewards[i] = rewardPerLockedToken[rebalancingPeriod][i];
    }
  }

  /// @notice Swaps the gas used from RebalanceETF, from vaultcurrency to ETH and send it to the dao
  /// @notice This way the vault will pay the gas for the RebalanceETF function
  /// @param _gasUsed total gas used by RebalanceETF
  function swapAndPayGasFee(uint256 _gasUsed) internal {
    uint256 amountEtherToVaultCurrency = Swap.amountOutSingleSwap(
      (_gasUsed + Swap.gasUsedForSwap) * controller.getGasPrice(),
      Swap.WETH,
      vaultCurrencyAddr,
      controller.uniswapQuoter(),
      controller.uniswapPoolFee()
    );

    uint256 wethReceived = Swap.swapTokensSingle(
      amountEtherToVaultCurrency,
      vaultCurrencyAddr,
      Swap.WETH,
      controller.uniswapRouter(),
      controller.uniswapQuoter(),
      controller.uniswapPoolFee()
    );
    Swap.unWrapWETHtoGov(payable(governed), wethReceived);

    emit GasPaidRebalanceETF(amountEtherToVaultCurrency);
  }

  /// @notice Helper function to set allocations
  /// @param _i Protocol number linked to an underlying protocol e.g compound_usdc_01
  function setAllocation(uint256 _i) internal {
    currentAllocations[_i] += deltaAllocations[_i];
    deltaAllocations[_i] = 0;
    require(currentAllocations[_i] >= 0, "Allocation underflow");
  }

  /// @notice Helper function so the rebalance will execute all withdrawals first
  /// @dev Executes and resets all deposits set in mapping(protocolToDeposit) by rebalanceETF
  /// @param protocolToDeposit array with amounts to deposit in protocols, the index being the protocol number.
  function executeDeposits(uint256[] memory protocolToDeposit) internal {
    uint256 latestID =controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      uint256 amount = protocolToDeposit[i];
      if (amount == 0) continue;
      // console.log("protocol: %s, deposit: %s", i, amount);
      depositInProtocol(i, amount);
    }
  }

  /// @notice Deposit amount to underlying protocol
  /// @dev Deposits VaultCurrency in Protocol e.g USDC
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to deposit
  function depositInProtocol(uint256 _protocolNum, uint256 _amount) internal {
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );

    if (getVaultBalance() < _amount) _amount = getVaultBalance();

    if (protocol.underlying != vaultCurrencyAddr) {
      _amount = Swap.swapStableCoins(
        _amount,
        vaultCurrencyAddr,
        protocol.underlying,
        uScale,
        controller.underlyingUScale(protocol.underlying),
        controller.curveIndex(vaultCurrencyAddr),
        controller.curveIndex(protocol.underlying),
        controller.curve3Pool(),
        controller.curve3PoolFee()
      );
    }

    IERC20(protocol.underlying).safeIncreaseAllowance(protocol.provider, _amount);
    controller.deposit(vaultNumber, _protocolNum, address(this), _amount);
  }

  /// @notice Withdraw amount from underlying protocol
  /// @dev shares = amount / PricePerShare
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to withdraw
  function withdrawFromProtocol(uint256 _protocolNum, uint256 _amount) internal {
    if (_amount <= 0) return;

    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );

    _amount = (_amount * protocol.uScale) / uScale;

    uint256 shares = controller.calcShares(vaultNumber, _protocolNum, _amount);
    IERC20(protocol.LPToken).safeIncreaseAllowance(protocol.provider, shares);

    uint256 amountReceived = controller.withdraw(vaultNumber, _protocolNum, address(this), shares);

    if (protocol.underlying != vaultCurrencyAddr) {
      _amount = Swap.swapStableCoins(
        amountReceived,
        protocol.underlying,
        vaultCurrencyAddr,
        controller.underlyingUScale(protocol.underlying),
        uScale,
        controller.curveIndex(protocol.underlying),
        controller.curveIndex(vaultCurrencyAddr),
        controller.curve3Pool(),
        controller.curve3PoolFee()
      );
    }
  }

  /// @notice Set total balance in VaultCurrency in all underlying protocols
  function setTotalUnderlying() public {
    uint totalUnderlying;
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      if (currentAllocations[i] == 0) continue;
      totalUnderlying += balanceUnderlying(i);
    }
    savedTotalUnderlying = totalUnderlying;
  }

  /// @notice Get balance in VaultCurrency in underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return Balance in VaultCurrency e.g USDC
  function balanceUnderlying(uint256 _protocolNum) public view returns (uint256) {
    uint256 protocolUScale = controller.getProtocolInfo(vaultNumber, _protocolNum).uScale;
    uint256 underlyingBalance = (controller.balanceUnderlying(
      vaultNumber,
      _protocolNum,
      address(this)
    ) * uScale) / protocolUScale;
    return underlyingBalance;
  }

  /// @notice Calculates how many shares are equal to the amount in vault currency
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount Amount in underyling token e.g USDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _protocolNum, uint256 _amount) public view returns (uint256) {
    uint256 protocolUScale = controller.getProtocolInfo(vaultNumber, _protocolNum).uScale;
    uint256 shares = controller.calcShares(
      vaultNumber,
      _protocolNum,
      (_amount * protocolUScale) / uScale
    );
    return shares;
  }

  /// @notice Get price for underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return protocolPrice Price per lp token
  function price(uint256 _protocolNum) public view returns (uint256) {
    return controller.exchangeRate(vaultNumber, _protocolNum);
  }

  /// @notice Set the delta allocated tokens by game contract
  /// @dev Allocation can be negative
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  /// @param _allocation Delta allocation in tokens
  function setDeltaAllocationsInt(uint256 _protocolNum, int256 _allocation) internal {
    require(!controller.getProtocolBlacklist(vaultNumber, _protocolNum), "Protocol on blacklist");
    deltaAllocations[_protocolNum] += _allocation;
    deltaAllocatedTokens += _allocation;
  }

  /// @notice Harvest extra tokens from underlying protocols
  /// @dev Loops over protocols in ETF and check if they are claimable in controller contract
  function claimTokens() public {
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      if (currentAllocations[i] == 0) continue;
      bool claim = controller.claim(vaultNumber, i);

      if (claim) {
        address govToken = controller.getProtocolInfo(vaultNumber, i).govToken;
        uint256 tokenBalance = IERC20(govToken).balanceOf(address(this));

        Swap.swapTokensMulti(
          tokenBalance,
          govToken,
          vaultCurrencyAddr,
          controller.uniswapRouter(),
          controller.uniswapQuoter(),
          controller.uniswapPoolFee()
        );
      }
    }
  }

  /// @notice The DAO should be able to blacklist protocols, the funds should be sent to the vault.
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  function blacklistProtocol(uint256 _protocolNum) external onlyDao {
    uint256 balanceProtocol = balanceUnderlying(_protocolNum);
    currentAllocations[_protocolNum] = 0;
    controller.setProtocolBlacklist(vaultNumber, _protocolNum);
    savedTotalUnderlying -= balanceProtocol;
    withdrawFromProtocol(_protocolNum, balanceProtocol);
  }

  /// @notice Checks if a rebalance is needed based on the set interval
  /// @return bool True of rebalance is needed, false if not
  function rebalanceNeeded() public view returns (bool) {
    return (block.timestamp - lastTimeStamp) > rebalanceInterval;
  }

  /// @notice Set the marginScale, the threshold used for deposits and withdrawals.
  /// @notice If the threshold is not met the deposit/ withdrawal is not executed.
  /// @dev Take into account the uScale (scale of the underlying).
  /// @param _marginScale Value at which to set the marginScale.
  function setMarginScale(int256 _marginScale) external onlyDao {
    marginScale = _marginScale;
  }

  /// @notice Set the liquidityPerc, the amount of liquidity which should be held in the vault after rebalancing.
  /// @dev The actual liquidityPerc could be a bit more or a bit less than the liquidityPerc set here.
  /// @dev This is because some deposits or withdrawals might not execute because they don't meet the marginScale.
  /// @param _liquidityPerc Value at which to set the liquidityPerc.
  function setLiquidityPerc(uint256 _liquidityPerc) external onlyDao {
    require(_liquidityPerc <= 100, "Percentage cannot exceed 100%");
    liquidityPerc = _liquidityPerc;
  }

  /// @notice Set the performanceFee, the percentage of the yield that goes to the game players.
  /// @dev The actual performanceFee could be a bit more or a bit less than the performanceFee set here due to approximations in the game.
  /// @param _performanceFee Value at which to set the performanceFee.
  function setPerformanceFee(uint256 _performanceFee) external onlyDao {
    require(_performanceFee <= 100, "Percentage cannot exceed 100%");
    performanceFee = _performanceFee;
  }

  /// @notice Set the governance address
  /// @param _governed New address of the governance / DAO
  function setGovernedAddress(address _governed) external onlyDao {
    governed = _governed;
  }

  /// @notice Set the gasFeeLiquidity, liquidity in vaultcurrency which always should be kept in vault to pay for rebalance gas fee
  /// @param _gasFeeLiquidity Value at which to set the gasFeeLiquidity in vaultCurrency
  function setGasFeeLiquidity(uint256 _gasFeeLiquidity) external onlyDao {
    gasFeeLiquidity = _gasFeeLiquidity;
  }

  /// @notice Set minimum interval for the rebalance function
  /// @param _timestampInternal UNIX timestamp
  function setRebalanceInterval(uint256 _timestampInternal) external onlyDao {
    rebalanceInterval = _timestampInternal;
  }

  function getVaultBalance() public view virtual returns (uint256) {
    return vaultCurrency.balanceOf(address(this));
  }

  /// @notice callback to receive Ether from unwrapping WETH
  receive() external payable {
    require(msg.sender == Swap.WETH, "Not WETH");
  }
}
