// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./Interfaces/IController.sol";
import "./Interfaces/IProvider.sol";
import "./Interfaces/IXProvider.sol";

import "./VaultToken.sol";
import "./libraries/Swap.sol";

import "hardhat/console.sol";

contract Vault is ReentrancyGuard, VaultToken {
  using SafeERC20 for IERC20Metadata;

  struct UserInfo {
    // amount in vaultCurrency the vault owes to the user
    uint256 withdrawalAllowance;
    // rebalancing period the withdrawal request is made
    uint256 withdrawalRequestPeriod;
    // amount in vaultCurrency the vault owes to the user
    uint256 rewardAllowance;
    // rebalancing period the reward request is made
    uint256 rewardRequestPeriod;
    // amount in vaultCurrency for the deposit request of the user
    uint256 depositRequest;
    // rebalancing period the deposit request is made
    uint256 depositRequestPeriod;
  }

  IERC20Metadata internal vaultCurrency;
  IController internal controller;

  bool public deltaAllocationsReceived;

  address public immutable nativeToken; // WETH
  address private dao;
  address private guardian;

  uint256 public vaultNumber;
  uint256 public liquidityPerc;
  uint256 public performanceFee; // percentage
  uint256 public rebalancingPeriod;
  int256 public marginScale;
  uint256 public exchangeRate; // always expressed in #decimals equal to the #decimals from the vaultCurrency

  // used in storePriceAndRewards, must be equal to DerbyToken.decimals()
  uint256 public BASE_SCALE = 1e18;

  // UNIX timestamp
  uint256 public rebalanceInterval;
  uint256 public lastTimeStamp;

  // total underlying of all protocols in vault, excluding vault balance
  uint256 public savedTotalUnderlying;

  // total amount of funds the vault reserved for users that made a withdrawalRequest
  uint256 internal totalWithdrawalRequests;
  uint256 internal totalDepositRequests;

  // total number of allocated Derby tokens currently (in derbytoken.decimals())
  uint256 public totalAllocatedTokens;
  // delta of the total number of Derby tokens allocated on next rebalancing
  int256 private deltaAllocatedTokens;

  address public derbyToken;
  address public game;
  address public xProvider;

  bool public vaultOff;

  uint32 public homeChain;
  uint256 public governanceFee; // Basis points
  uint256 public minScale; // before decimals!
  uint256 public minimumDeposit;
  uint256 public lastRewardPeriod;

  string internal allowanceError = "!Allowance";
  string internal noFundsError = "No funds";

  // training
  bool private training;
  uint256 private maxTrainingDeposit;
  mapping(address => bool) private whitelist;

  // (protocolNumber => currentAllocation): current allocations over the protocols
  mapping(uint256 => uint256) internal currentAllocations;

  // (protocolNumber => deltaAllocation): delta of the portfolio on next rebalancing
  mapping(uint256 => int256) internal deltaAllocations;

  // historical reward per protocol per token, formula: TVL * yield * perfFee / totalLockedTokens
  // (rebalancingPeriod => protocolId => rewardPerLockedToken)
  mapping(uint256 => mapping(uint256 => int256)) public rewardPerLockedToken; // in BASE_SCALE * vaultCurrency.decimals() nr of decimals

  // (protocolNumber => lastPrice): last price of underlying protocol vault
  mapping(uint256 => uint256) public lastPrices; // in protocol.LPToken.decimals()

  // (userAddress => userInfo struct)
  mapping(address => UserInfo) internal userInfo;

  modifier onlyDao() {
    require(msg.sender == dao, "Vault: only DAO");
    _;
  }

  modifier onlyGuardian() {
    require(msg.sender == guardian, "only Guardian");
    _;
  }

  modifier onlyXProvider() {
    require(msg.sender == xProvider, "only xProvider");
    _;
  }

  event DepositInProtocol(uint256 protocolNum, uint256 amount);
  event WithdrawFromProtocol(uint256 protocolNum, uint256 amount);
  event LastPrices(uint256 protocolNum, uint256 rebalancingPeriod, uint256 price);
  event PushedRewardsToGame(uint256 vaultNumber, uint32 chain, int256[] rewards);
  event Deposit(address user, uint256 amount, uint256 shares);
  event Withdraw(address user, uint256 amount, uint256 value);
  event Rebalance(uint256 vaultNumber, uint256 rebalancingPeriod);

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
  ) VaultToken(_name, _symbol, _decimals) {
    controller = IController(_controller);
    vaultCurrency = IERC20Metadata(_vaultCurrency);

    vaultNumber = _vaultNumber;
    dao = _dao;
    lastTimeStamp = block.timestamp;
    nativeToken = _nativeToken;

    exchangeRate = 10 ** vaultCurrency.decimals();
    governanceFee = 0;
    minScale = _minScale;
    minimumDeposit = 100 * 10 ** (vaultCurrency.decimals() - minScale);
  }

  /// @notice Vaults rebalance
  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev amountToProtocol = totalAmount * currentAllocation / totalAllocatedTokens
  /// @dev amountToDeposit = amountToProtocol - currentBalanceProtocol
  /// @dev if amountToDeposit < 0 => withdraw
  /// @dev Execute all withdrawals before deposits
  function rebalance() external nonReentrant {
    require(rebalanceNeeded(), "No rebalance needed");
    require(deltaAllocationsReceived, "!Delta allocations");
    rebalancingPeriod++;
    uint256 latestID = controller.latestProtocolId(vaultNumber);

    storePriceAndRewardsLoop(latestID); // based on allocations and underlying of last period and the price increases between last and current period

    setTotalUnderlying();
    uint256 underlyingIncBalance = calcUnderlyingIncBalance();

    settleDeltaAllocation();
    uint256[] memory protocolToDeposit = rebalanceCheckProtocols(latestID, underlyingIncBalance);

    executeDeposits(protocolToDeposit);

    savedTotalUnderlying = underlyingIncBalance;
    uint256 oldExchangeRate = exchangeRate;

    exchangeRate = calculateExchangeRate(savedTotalUnderlying);

    if (exchangeRate > oldExchangeRate)
      exchangeRate = includePerformanceFee(exchangeRate, oldExchangeRate);

    lastTimeStamp = block.timestamp;
    emit Rebalance(vaultNumber, rebalancingPeriod);
  }

  /// @notice Function to include the performanceFee in the exchangeRate
  /// @dev Calculated by first evaluating the performance by determining the increase in exchangeRate
  /// @dev Next the performanceFee is calculated by multiplying the performance with the percentage after substracting the performanceFee
  /// @param _exchangeRate The exchangeRate before the performanceFee is added
  /// @param _oldExchangeRate The exchangeRate before the rebalance
  /// @return uint256 The new exchangeRate including the performanceFee
  function includePerformanceFee(
    uint256 _exchangeRate,
    uint256 _oldExchangeRate
  ) internal view returns (uint256) {
    uint256 nominator = (_exchangeRate - _oldExchangeRate) *
      _oldExchangeRate *
      (100 - performanceFee);
    uint256 denominator = 100 * _oldExchangeRate;
    return nominator / denominator + _oldExchangeRate;
  }

  /// @notice Helper to return underlying balance plus totalUnderlying - liquidty for the vault
  /// @return underlying totalUnderlying - liquidityVault
  function calcUnderlyingIncBalance() internal view returns (uint256) {
    uint256 totalUnderlyingInclVaultBalance = savedTotalUnderlying +
      getVaultBalance() -
      totalWithdrawalRequests;
    uint256 liquidityVault = (totalUnderlyingInclVaultBalance * liquidityPerc) / 100;
    return totalUnderlyingInclVaultBalance - liquidityVault;
  }

  /// @notice Adds deltaAllocatedTokens to totalAllocatedTokens
  function settleDeltaAllocation() internal {
    int256 newTotalAllocatedTokens = int(totalAllocatedTokens) + deltaAllocatedTokens;
    require(newTotalAllocatedTokens >= 0);

    totalAllocatedTokens = uint(newTotalAllocatedTokens);
    deltaAllocatedTokens = 0;
    deltaAllocationsReceived = false;
  }

  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev Loops over all protocols in ETF, calculate new currentAllocation based on deltaAllocation
  /// @dev Also calculate the performance fee here. This is an amount, based on the current TVL (before the rebalance),
  /// @dev the performanceFee and difference between the current exchangeRate and the exchangeRate of the last rebalance of the vault.
  /// @param _newTotalUnderlying this will be the new total underlying: Totalunderlying = TotalUnderlyingInProtocols - BalanceVault (in vaultCurrency.decimals())
  /// @return uint256[] with amounts to deposit in protocols, the index being the protocol number.
  function rebalanceCheckProtocols(
    uint256 _latestId,
    uint256 _newTotalUnderlying
  ) internal returns (uint256[] memory) {
    uint256[] memory protocolToDeposit = new uint[](controller.latestProtocolId(vaultNumber));

    for (uint i = 0; i < _latestId; i++) {
      bool isBlacklisted = controller.getProtocolBlacklist(vaultNumber, i);

      if (isBlacklisted) continue;
      setAllocation(i);

      uint256 amountToProtocol = calcAmountToProtocol(_newTotalUnderlying, i);
      uint256 currentBalance = balanceUnderlying(i);

      int256 amountToDeposit = int(amountToProtocol) - int(currentBalance);
      uint256 amountToWithdraw = amountToDeposit < 0 ? currentBalance - amountToProtocol : 0;

      if (amountToDeposit > marginScale) {
        protocolToDeposit[i] = uint256(amountToDeposit);
      }
      if (amountToWithdraw > uint(marginScale) || currentAllocations[i] == 0) {
        withdrawFromProtocol(i, amountToWithdraw);
      }
    }

    return protocolToDeposit;
  }

  /// @notice Calculates the amount to deposit or withdraw to protocol during a vault rebalance
  /// @param _totalAmount TotalAmount = TotalAmountInProtocols - BalanceVault
  /// @param _protocol Protocol id number
  /// @return amountToProtocol amount to deposit or withdraw to protocol (in vaultCurency.decimals())
  function calcAmountToProtocol(
    uint256 _totalAmount,
    uint256 _protocol
  ) internal view returns (uint256 amountToProtocol) {
    if (totalAllocatedTokens == 0) amountToProtocol = 0;
    else amountToProtocol = (_totalAmount * currentAllocations[_protocol]) / totalAllocatedTokens;
  }

  /// @notice Harvest extra tokens from underlying protocols
  /// @dev Loops over protocols in ETF and check if they are claimable in controller contract
  function storePriceAndRewardsLoop(uint256 _latestId) internal {
    for (uint i = 0; i < _latestId; i++) {
      storePriceAndRewards(i);
    }
  }

  /// @notice Stores the historical price and the reward per rounded locked token, ignoring decimals.
  /// @dev formula yield protocol i at time t: y(it) = (P(it) - P(it-1)) / P(it-1).
  /// @dev formula rewardPerLockedToken for protocol i at time t: r(it) = y(it) * TVL(t) * perfFee(t) / totalLockedTokens(t)
  /// @dev later, when the total rewards are calculated for a game player we multiply this (r(it)) by the locked tokens on protocol i at time t
  /// @param _protocolId Protocol id number.
  function storePriceAndRewards(uint256 _protocolId) internal {
    uint period = rebalancingPeriod;
    uint256 currentPrice = price(_protocolId); // in protocol.LPToken.decimals()
    if (controller.getProtocolBlacklist(vaultNumber, _protocolId)) {
      rewardPerLockedToken[period][_protocolId] = -1;
      lastPrices[_protocolId] = currentPrice;
      return;
    }

    if (lastPrices[_protocolId] == 0) {
      lastPrices[_protocolId] = currentPrice;
      return;
    }

    int256 priceDiff = int256(currentPrice) - int256(lastPrices[_protocolId]);
    int256 nominator = (int256(savedTotalUnderlying * performanceFee * BASE_SCALE) * priceDiff);
    int256 totalAllocatedTokensRounded = int256(totalAllocatedTokens) / int(BASE_SCALE);
    int256 denominator = totalAllocatedTokensRounded * int256(lastPrices[_protocolId]) * 100; // * 100 cause perfFee is in percentages

    if (totalAllocatedTokensRounded == 0) {
      rewardPerLockedToken[period][_protocolId] = 0;
    } else {
      rewardPerLockedToken[period][_protocolId] = nominator / denominator;
    }

    lastPrices[_protocolId] = currentPrice;
    emit LastPrices(_protocolId, rebalancingPeriod, currentPrice);
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

  /// @notice Helper function to set allocations
  /// @param _i Protocol number linked to an underlying protocol e.g compound_usdc_01
  function setAllocation(uint256 _i) internal {
    int256 newCurrentAllocation = int(currentAllocations[_i]) + deltaAllocations[_i];
    require(newCurrentAllocation >= 0);

    currentAllocations[_i] = uint(newCurrentAllocation);
    deltaAllocations[_i] = 0;
  }

  /// @notice Helper function so the rebalance will execute all withdrawals first
  /// @dev Executes and resets all deposits set in mapping(protocolToDeposit) by rebalanceETF
  /// @param protocolToDeposit array with amounts to deposit in protocols, the index being the protocol number.
  function executeDeposits(uint256[] memory protocolToDeposit) internal {
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      uint256 amount = protocolToDeposit[i];
      if (amount == 0) continue;
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

    IERC20Metadata(protocol.underlying).safeIncreaseAllowance(protocol.provider, _amount);
    IProvider(protocol.provider).deposit(_amount, protocol.LPToken, protocol.underlying);
    emit DepositInProtocol(_protocolNum, _amount);
  }

  /// @notice Withdraw amount from underlying protocol
  /// @dev shares = amount / PricePerShare
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to withdraw
  function withdrawFromProtocol(
    uint256 _protocolNum,
    uint256 _amount
  ) internal returns (uint256 amountReceived) {
    if (_amount <= 0) return 0;
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );
    require(protocol.underlying == address(vaultCurrency), "Provider underlying mismatch");

    uint256 shares = IProvider(protocol.provider).calcShares(_amount, protocol.LPToken);
    uint256 balance = IProvider(protocol.provider).balance(address(this), protocol.LPToken);

    if (shares == 0) return 0;
    if (balance < shares) shares = balance;

    IERC20Metadata(protocol.LPToken).safeIncreaseAllowance(protocol.provider, shares);
    amountReceived = IProvider(protocol.provider).withdraw(
      shares,
      protocol.LPToken,
      protocol.underlying
    );
    emit WithdrawFromProtocol(_protocolNum, amountReceived);
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
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );
    uint256 underlyingBalance = IProvider(protocol.provider).balanceUnderlying(
      address(this),
      protocol.LPToken
    );
    return underlyingBalance;
  }

  /// @notice Calculates how many shares are equal to the amount in vault currency
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount Amount in underyling token e.g USDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _protocolNum, uint256 _amount) public view returns (uint256) {
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );
    uint256 shares = IProvider(protocol.provider).calcShares(_amount, protocol.LPToken);

    return shares;
  }

  /// @notice Get price for underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return protocolPrice Price per lp token
  function price(uint256 _protocolNum) public view returns (uint256) {
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );
    return IProvider(protocol.provider).exchangeRate(protocol.LPToken);
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

  /// @notice Claims and swaps tokens from the underlying protocol
  /// @dev Claims governance tokens from the underlying protocol if claimable, and swaps them to the vault's underlying token
  /// @param _protocolNum The protocol ID for which to claim and swap tokens
  function claimAndSwapTokens(
    uint256 _protocolNum,
    uint256 _minAmount,
    uint256 _deadline
  ) public onlyGuardian {
    bool claim = controller.claim(vaultNumber, _protocolNum);
    if (claim) {
      address govToken = controller.getGovToken(vaultNumber, _protocolNum);
      uint256 tokenBalance = IERC20Metadata(govToken).balanceOf(address(this));
      Swap.swapTokensMulti(
        Swap.SwapInOut(
          tokenBalance,
          _deadline,
          _minAmount,
          nativeToken,
          govToken,
          address(vaultCurrency)
        ),
        controller.getUniswapParams(),
        false
      );
    }
  }

  function getVaultBalance() public view returns (uint256) {
    return vaultCurrency.balanceOf(address(this));
  }

  /// @notice Checks if a rebalance is needed based on the set interval
  /// @return bool True of rebalance is needed, false if not
  function rebalanceNeeded() public view returns (bool) {
    return (block.timestamp - lastTimeStamp) > rebalanceInterval || msg.sender == guardian;
  }

  /// @notice Getter for dao address
  function getDao() public view returns (address) {
    return dao;
  }

  /// @notice Getter for guardian address
  function getGuardian() public view returns (address) {
    return guardian;
  }

  /// @notice Function to calculate the exchangeRate (decimals = vaultCurrency decimals)
  /// @param totalUnderlying Total underlying in vaultCurrency
  /// @return price Exchange rate
  function calculateExchangeRate(uint256 totalUnderlying) public view returns (uint256) {
    uint256 price;
    price = totalSupply() == 0
      ? 10 ** vaultCurrency.decimals()
      : (totalUnderlying * (10 ** decimals())) / totalSupply();
    return price;
  }

  /// @notice function that enables direct deposits into the vault
  /// @dev this can only be done if the funds from the user will be deposited directly into the underlying protocols. Hence, this is very gas intensive
  /// @param _amount Amount to deposit in vaultCurrency
  /// @return shares Amount of shares minted in LPtoken.decimals()
  function deposit(uint256 _amount) public returns (uint256) {
    require(_amount >= minimumDeposit, "Minimum deposit");

    if (training) {
      require(whitelist[msg.sender]);
    }

    uint256 balanceBefore = getVaultBalance();
    vaultCurrency.safeTransferFrom(msg.sender, address(this), _amount);
    uint256 balanceAfter = getVaultBalance();
    uint256 amount = balanceAfter - balanceBefore;

    uint256 latestID = controller.latestProtocolId(vaultNumber);
    uint256 totalUnderlying = 0;
    for (uint i = 0; i < latestID; i++) {
      bool isBlacklisted = controller.getProtocolBlacklist(vaultNumber, i);

      if (isBlacklisted) continue;

      uint256 amountToProtocol = calcAmountToProtocol(amount, i);
      totalUnderlying += balanceUnderlying(i);
      depositInProtocol(i, amountToProtocol);
    }

    exchangeRate = calculateExchangeRate(totalUnderlying);

    uint256 shares = (amount * (10 ** decimals())) / exchangeRate;
    _mint(msg.sender, shares);
    emit Deposit(msg.sender, amount, shares);
    return shares;
  }

  /// @notice Enables a user to make a deposit into the Vault.
  /// @dev This function allows a user to deposit an amount greater than or equal to the minimum deposit,
  /// transfers the deposited amount from the user to the Vault, and records the deposit request.
  /// If the training mode is active, the function checks if the user is whitelisted and the deposit doesn't exceed the max training deposit.
  /// @param _amount The amount that the user wants to deposit in vaultCurrency.
  function depositRequest(uint256 _amount) external nonReentrant {
    UserInfo storage user = userInfo[msg.sender];
    require(_amount >= minimumDeposit, "Minimum deposit");

    if (training) {
      require(whitelist[msg.sender]);
      require(user.depositRequest + _amount <= maxTrainingDeposit);
    }

    uint256 balanceBefore = getVaultBalance();
    vaultCurrency.safeTransferFrom(msg.sender, address(this), _amount);
    uint256 balanceAfter = getVaultBalance();

    uint256 amount = balanceAfter - balanceBefore;
    user.depositRequest += amount;
    user.depositRequestPeriod = rebalancingPeriod;
    totalDepositRequests += amount;
  }

  /// @notice Redeems the pending deposit requests for the calling user.
  /// @dev This function allows a user to redeem their deposit requests and receive shares.
  /// This can only be done if a deposit request has been made and the current rebalancing period is greater than
  /// the period in which the deposit request was made.
  /// The function will mint new shares in exchange for the deposit and update the user's deposit request status.
  /// @return shares The number of shares minted in exchange for the deposit.
  function redeemDeposit() external nonReentrant returns (uint256 shares) {
    UserInfo storage user = userInfo[msg.sender];
    uint256 depositRequest = user.depositRequest;

    require(rebalancingPeriod > user.depositRequestPeriod, noFundsError);
    shares = (depositRequest * (10 ** decimals())) / exchangeRate;

    deleteDepositRequest(user);

    _mint(msg.sender, shares);
    emit Deposit(msg.sender, depositRequest, shares);
  }

  /// @notice Cancel the deposit request for the caller.
  function cancelDepositRequest() external nonReentrant {
    UserInfo storage user = userInfo[msg.sender];
    uint256 depositRequest = user.depositRequest;
    deleteDepositRequest(user);
    vaultCurrency.safeTransfer(msg.sender, depositRequest);
  }

  /// @dev Deletes the user's deposit request and updates the total deposit requests.
  /// @param user The user whose deposit request is being deleted.
  function deleteDepositRequest(UserInfo storage user) internal {
    require(user.depositRequest > 0, allowanceError);
    totalDepositRequests -= user.depositRequest;
    delete user.depositRequest;
    delete user.depositRequestPeriod;
  }

  /// @notice function that enables direct withdrawals from the vault
  /// @dev this can only be done if the funds from the user will be withdrawed directly from the underlying protocols. Hence, this is very gas intensive
  /// @param _amount Amount to withdraw in vaultCurrency
  /// @return shares Amount of shares the user needs to supply in LPtoken decimals()
  function withdraw(uint256 _amount) public returns (uint256) {
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    uint256 totalUnderlying = 0;
    uint256 vaultBalance = getVaultBalance();
    uint256 amountFromProtocol;
    uint256 totalWithdrawal;
    for (uint i = 0; i < latestID; i++) {
      bool isBlacklisted = controller.getProtocolBlacklist(vaultNumber, i);

      if (isBlacklisted) continue;

      totalUnderlying += balanceUnderlying(i);

      if (vaultBalance < _amount) {
        amountFromProtocol = calcAmountToProtocol(_amount - vaultBalance, i);
        totalWithdrawal += withdrawFromProtocol(i, amountFromProtocol);
      } else {
        totalWithdrawal = _amount;
      }
    }

    exchangeRate = calculateExchangeRate(totalUnderlying);

    uint256 shares = (_amount * (10 ** decimals())) / exchangeRate;
    uint256 balance = balanceOf(msg.sender);
    shares = checkForBalance(shares, balance, decimals());
    _burn(msg.sender, shares);

    transferFunds(msg.sender, totalWithdrawal);
    emit Withdraw(msg.sender, totalWithdrawal, shares);
    return shares;
  }

  /// @notice Withdrawal request for when the vault doesnt have enough funds available
  /// @dev Will give the user allowance for his funds and pulls the extra funds at the next rebalance
  /// @param _amount Amount to withdraw in vaultCurrency
  /// @return shares Amount of shares the user needs to supply in LPtoken decimals()
  function withdrawalRequest(uint256 _amount) external nonReentrant returns (uint256 shares) {
    UserInfo storage user = userInfo[msg.sender];
    require(rebalancingPeriod != 0 && user.withdrawalRequestPeriod == 0, "Already a request");

    shares = (_amount * (10 ** decimals())) / exchangeRate;
    uint256 balance = balanceOf(msg.sender);
    shares = checkForBalance(shares, balance, decimals());
    _burn(msg.sender, shares);

    user.withdrawalAllowance = _amount;
    user.withdrawalRequestPeriod = rebalancingPeriod;
    totalWithdrawalRequests += _amount;
    emit Withdraw(msg.sender, _amount, shares);
  }

  /// @notice Withdraw the allowance the user requested on the last rebalancing period
  /// @dev Will send the user funds and reset the allowance
  /// @return value Amount received by seller in vaultCurrency, in vaultcurrency.decimals()
  function withdrawAllowance() external nonReentrant returns (uint256 value) {
    UserInfo storage user = userInfo[msg.sender];
    require(user.withdrawalAllowance > 0, allowanceError);
    require(rebalancingPeriod > user.withdrawalRequestPeriod, noFundsError);

    value = user.withdrawalAllowance;
    value = IXProvider(xProvider).calculateEstimatedAmount(value);

    totalWithdrawalRequests -= user.withdrawalAllowance;
    delete user.withdrawalAllowance;
    delete user.withdrawalRequestPeriod;

    transferFunds(msg.sender, value);
  }

  /// @notice Substract governance fee from value
  /// @param _receiver Receiving adress for the vaultcurrency
  /// @param _value Amount received by seller in vaultCurrency
  function transferFunds(address _receiver, uint256 _value) internal {
    uint256 govFee = (_value * governanceFee) / 10_000;

    vaultCurrency.safeTransfer(getDao(), govFee);
    vaultCurrency.safeTransfer(_receiver, _value - govFee);
  }

  /// @notice Function for the game to set a withdrawalRequest for the rewards of the game user
  /// @param _value Amount to set a request in vaultCurrency
  /// @param _user Address of the user
  function redeemRewardsGame(uint256 _value, address _user) external onlyXProvider nonReentrant {
    UserInfo storage user = userInfo[_user];
    require(user.rewardAllowance == 0, allowanceError);

    user.rewardAllowance = _value;
    user.rewardRequestPeriod = rebalancingPeriod;
    totalWithdrawalRequests += _value;
  }

  /// @notice Withdraw the reward allowance set by the game using the redeemRewardsGame function
  /// @dev Swaps vaultCurrency to Derby tokens, sends the funds to the user, and resets the allowance
  /// @return value The amount of reward withdrawn by the user
  function withdrawRewards() external nonReentrant returns (uint256 value) {
    UserInfo storage user = userInfo[msg.sender];
    require(user.rewardAllowance > 0, allowanceError);
    require(rebalancingPeriod > user.rewardRequestPeriod, noFundsError);

    value = user.rewardAllowance;
    totalWithdrawalRequests -= user.rewardAllowance;

    delete user.rewardAllowance;
    delete user.rewardRequestPeriod;

    vaultCurrency.safeTransfer(msg.sender, value);
  }

  /// @notice Sometimes the balance of a coin is a fraction less then expected due to rounding errors
  /// @notice This is to make sure the vault doesnt get stuck
  /// @notice Value will be set to the balance
  /// @notice When divergence is greater then minScale it will revert
  /// @param _value Value the user wants
  /// @param _balance Balance of the coin
  /// @param _decimals Decimals of the coin and balance
  /// @return value Value - divergence
  function checkForBalance(
    uint256 _value,
    uint256 _balance,
    uint256 _decimals
  ) internal view returns (uint256) {
    if (_value > _balance) {
      uint256 oldValue = _value;
      _value = _balance;
      require(oldValue - _value <= (10 ** (_decimals - minScale)), "Max divergence");
    }
    return _value;
  }

  /// @notice See receiveProtocolAllocations below
  function receiveProtocolAllocations(int256[] memory _deltas) external onlyXProvider {
    receiveProtocolAllocationsInt(_deltas);
  }

  /// @notice Game pushes deltaAllocations to vaults
  /// @notice Receives protocol allocation array from the game and settles the allocations
  /// @param _deltas Array with delta allocations where the index matches the protocolId
  function receiveProtocolAllocationsInt(int256[] memory _deltas) internal {
    for (uint i = 0; i < _deltas.length; i++) {
      int256 allocation = _deltas[i];
      if (allocation == 0) continue;
      setDeltaAllocationsInt(i, allocation);
    }

    deltaAllocationsReceived = true;
  }

  /// @notice Vaults push rewardsPerLockedToken to game
  function sendRewardsToGame() external payable {
    require(lastRewardPeriod < rebalancingPeriod, "rewards already sent");

    int256[] memory rewards = rewardsToArray();
    IXProvider(xProvider).pushRewardsToGame{value: msg.value}(vaultNumber, homeChain, rewards);

    lastRewardPeriod = rebalancingPeriod;

    emit PushedRewardsToGame(vaultNumber, homeChain, rewards);
  }

  /// @notice Returns the amount in vaultCurrency the user is able to withdraw
  function getWithdrawalAllowance() external view returns (uint256) {
    return userInfo[msg.sender].withdrawalAllowance;
  }

  /// @notice Returns the rewards the user is able to withdraw
  function getRewardAllowance() external view returns (uint256) {
    return userInfo[msg.sender].rewardAllowance;
  }

  /// @notice Get the deposit request for a specific user.
  /// @return The deposit request of the user in vaultCurrency.
  function getDepositRequest() external view returns (uint256) {
    return userInfo[msg.sender].depositRequest;
  }

  /*
  Only Dao functions
  */

  /// @notice Set the performanceFee, the percentage of the yield that goes to the game players.
  /// @dev The actual performanceFee could be a bit more or a bit less than the performanceFee set here due to approximations in the game.
  /// @param _performanceFee Value at which to set the performanceFee.
  function setPerformanceFee(uint256 _performanceFee) external onlyDao {
    require(_performanceFee <= 100);
    performanceFee = _performanceFee;
  }

  /// @notice Set the governance address
  /// @param _dao New address of the governance / DAO
  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }

  /// @notice Setter for guardian address
  /// @param _guardian new address of the guardian
  function setGuardian(address _guardian) external onlyDao {
    guardian = _guardian;
  }

  /// @notice Setter for controller address
  function setController(address _controller) external onlyDao {
    controller = IController(_controller);
  }

  /// @notice Setter for xProvider address
  /// @param _xProvider new address of xProvider on this chain
  function setHomeXProvider(address _xProvider) external onlyDao {
    xProvider = _xProvider;
  }

  /// @notice Setter for derby token address
  /// @param _token New address of the derby token
  function setDaoToken(address _token) external onlyDao {
    derbyToken = _token;
  }

  /// @notice Setter for maximum divergence a user can get during a withdraw
  /// @param _minScale New maximum divergence in vaultCurrency
  function setminScale(uint256 _minScale) external onlyDao {
    minScale = _minScale;
  }

  /*
  Only Guardian functions
  */

  /// @notice Set minimum interval for the rebalance function
  /// @param _timestampInternal UNIX timestamp
  function setRebalanceInterval(uint256 _timestampInternal) external onlyGuardian {
    rebalanceInterval = _timestampInternal;
  }

  /// @notice The DAO should be able to blacklist protocols, the funds should be sent to the vault.
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  function blacklistProtocol(uint256 _protocolNum) external onlyGuardian {
    totalAllocatedTokens -= currentAllocations[_protocolNum];
    currentAllocations[_protocolNum] = 0;

    controller.setProtocolBlacklist(vaultNumber, _protocolNum);
  }

  /// @notice Withdraws the funds from a blacklisted protocol and updates the savedTotalUnderlying.
  /// @dev This function should only be called after a protocol has been blacklisted.
  /// @param _protocolNum The protocol number from which to withdraw the funds.
  function withdrawFromBlacklistedProtocol(
    uint256 _protocolNum,
    uint256 _minAmount,
    uint256 _deadline
  ) external onlyGuardian {
    bool isBlacklisted = controller.getProtocolBlacklist(vaultNumber, _protocolNum);
    require(isBlacklisted, "!Blacklisted");

    claimAndSwapTokens(_protocolNum, _minAmount, _deadline);

    uint256 balanceBefore = balanceUnderlying(_protocolNum);
    withdrawFromProtocol(_protocolNum, balanceBefore);
    uint256 balanceAfter = balanceUnderlying(_protocolNum);
    uint256 balanceReceived = balanceBefore - balanceAfter;

    savedTotalUnderlying = savedTotalUnderlying >= balanceReceived
      ? savedTotalUnderlying - balanceReceived
      : 0;
  }

  /// @notice Set the marginScale, the threshold used for deposits and withdrawals.
  /// @notice If the threshold is not met the deposit/ withdrawal is not executed.
  /// @dev Take into account the scale of the underlying.
  /// @param _marginScale Value at which to set the marginScale.
  function setMarginScale(int256 _marginScale) external onlyGuardian {
    marginScale = _marginScale;
  }

  /// @notice Set the liquidityPerc, the amount of liquidity which should be held in the vault after rebalancing.
  /// @dev The actual liquidityPerc could be a bit more or a bit less than the liquidityPerc set here.
  /// @dev This is because some deposits or withdrawals might not execute because they don't meet the marginScale.
  /// @param _liquidityPerc Value at which to set the liquidityPerc.
  function setLiquidityPerc(uint256 _liquidityPerc) external onlyGuardian {
    require(_liquidityPerc <= 100);
    liquidityPerc = _liquidityPerc;
  }

  /// @notice Guardian function
  function receiveProtocolAllocationsGuard(int256[] memory _deltas) external onlyGuardian {
    receiveProtocolAllocationsInt(_deltas);
  }

  /// @notice Setter for new homeChain Id
  function setHomeChain(uint32 _homeChain) external onlyGuardian {
    homeChain = _homeChain;
  }

  /// @notice Setter for governance fee
  /// @param _fee Fee in basis points
  function setGovernanceFee(uint16 _fee) external onlyGuardian {
    governanceFee = _fee;
  }

  /// @notice Setter to control the training state in de deposit function
  function setTraining(bool _state) external onlyGuardian {
    training = _state;
  }

  /// @notice Setter for maximum amount to be able to deposit in training state
  function setTrainingDeposit(uint256 _maxDeposit) external onlyGuardian {
    maxTrainingDeposit = _maxDeposit;
  }

  /// @notice Setter to add an address to the whitelist
  function addToWhitelist(address _address) external onlyGuardian {
    whitelist[_address] = true;
  }

  /// @dev Sets the minimum deposit amount allowed.
  /// @param _newMinimumDeposit The new minimum deposit amount to be set.
  function setMinimumDeposit(uint256 _newMinimumDeposit) external onlyGuardian {
    minimumDeposit = _newMinimumDeposit;
  }

  /// @notice callback to receive Ether from unwrapping WETH
  receive() external payable {
    require(msg.sender == nativeToken, "Not WETH");
  }
}
