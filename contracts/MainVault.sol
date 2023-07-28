// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "./Vault.sol";

import "./Interfaces/IXProvider.sol";

contract MainVault is Vault, VaultToken {
  using SafeERC20 for IERC20;

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

  address public derbyToken;
  address public game;
  address public xProvider;

  // True when rewards should be swapped to derby tokens
  bool public swapRewards;
  bool public vaultOff;

  // total amount of withdrawal requests for the vault to pull extra during a cross-chain rebalance, will be upped when a user makes a withdrawalRequest
  // during a cross-chain rebalance the vault will pull extra funds by the amount of totalWithdrawalRequests and the totalWithdrawalRequests will turn into actual reservedFunds
  uint256 internal totalWithdrawalRequests;
  uint256 internal totalDepositRequests;
  uint256 public exchangeRate; // always expressed in #decimals equal to the #decimals from the vaultCurrency
  uint32 public homeChain;
  uint256 public amountToSendXChain;
  uint256 public governanceFee; // Basis points
  uint256 public maxDivergenceWithdraws;
  uint256 public minimumDeposit;

  string internal allowanceError = "!Allowance";
  string internal noFundsError = "No funds";

  // (userAddress => userInfo struct)
  mapping(address => UserInfo) internal userInfo;

  // training
  bool private training;
  uint256 private maxTrainingDeposit;
  mapping(address => bool) private whitelist;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _vaultNumber,
    address _dao,
    address _game,
    address _controller,
    address _vaultCurrency,
    address _nativeToken
  )
    VaultToken(_name, _symbol, _decimals)
    Vault(_vaultNumber, _dao, _controller, _vaultCurrency, _nativeToken)
  {
    exchangeRate = 10 ** decimals();
    game = _game;
    governanceFee = 0;
    maxDivergenceWithdraws = 1_000_000;
    minimumDeposit = 100 * 10 ** decimals();
  }

  modifier onlyXProvider() {
    require(msg.sender == xProvider, "only xProvider");
    _;
  }

  modifier onlyWhenIdle() {
    require(state == State.Idle, "Rebalancing");
    _;
  }

  modifier onlyGame() {
    require(msg.sender == game, "only game");
    _;
  }

  event PushTotalUnderlying(
    uint256 _vaultNumber,
    uint32 _chainId,
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  );
  event RebalanceXChain(uint256 _vaultNumber, uint256 _amount, address _asset);
  event PushedRewardsToGame(uint256 _vaultNumber, uint32 _chain, int256[] _rewards);

  /// @notice Enables a user to make a deposit into the Vault.
  /// @dev This function allows a user to deposit an amount greater than or equal to the minimum deposit,
  /// transfers the deposited amount from the user to the Vault, and records the deposit request.
  /// If the training mode is active, the function checks if the user is whitelisted and the deposit doesn't exceed the max training deposit.
  /// @param _amount The amount that the user wants to deposit.
  function deposit(uint256 _amount) external nonReentrant onlyWhenIdle {
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
  function redeemDeposit() external nonReentrant onlyWhenIdle returns (uint256 shares) {
    UserInfo storage user = userInfo[msg.sender];
    uint256 depositRequest = user.depositRequest;

    require(rebalancingPeriod > user.depositRequestPeriod, noFundsError);
    shares = (depositRequest * (10 ** decimals())) / exchangeRate;

    deleteDepositRequest(user);

    _mint(msg.sender, shares);
  }

  /// @notice Cancel the deposit request for the caller.
  function cancelDepositRequest() external nonReentrant onlyWhenIdle {
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

  /// @notice Withdrawal request for when the vault doesnt have enough funds available
  /// @dev Will give the user allowance for his funds and pulls the extra funds at the next rebalance
  /// @param _amount Amount to withdraw in LP token, in LPtoken.decimals()
  /// @return value Amount received by seller in vaultCurrency, in vaultcurrency.decimals()
  function withdrawalRequest(
    uint256 _amount
  ) external nonReentrant onlyWhenIdle returns (uint256 value) {
    UserInfo storage user = userInfo[msg.sender];
    require(rebalancingPeriod != 0 && user.withdrawalRequestPeriod == 0, "Already a request");

    value = (_amount * exchangeRate) / (10 ** decimals());

    _burn(msg.sender, _amount);

    user.withdrawalAllowance = value;
    user.withdrawalRequestPeriod = rebalancingPeriod;
    totalWithdrawalRequests += value;
  }

  /// @notice Withdraw the allowance the user requested on the last rebalancing period
  /// @dev Will send the user funds and reset the allowance
  /// @return value Amount received by seller in vaultCurrency, in vaultcurrency.decimals()
  function withdrawAllowance() external nonReentrant onlyWhenIdle returns (uint256 value) {
    UserInfo storage user = userInfo[msg.sender];
    require(user.withdrawalAllowance > 0, allowanceError);
    require(rebalancingPeriod > user.withdrawalRequestPeriod, noFundsError);

    value = user.withdrawalAllowance;
    value = IXProvider(xProvider).calculateEstimatedAmount(value);
    value = checkForBalance(value);

    reservedFunds -= value;
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
  function redeemRewardsGame(
    uint256 _value,
    address _user
  ) external onlyGame nonReentrant onlyWhenIdle {
    UserInfo storage user = userInfo[_user];
    require(user.rewardAllowance == 0, allowanceError);

    user.rewardAllowance = _value;
    user.rewardRequestPeriod = rebalancingPeriod;
    totalWithdrawalRequests += _value;
  }

  /// @notice Withdraw the reward allowance set by the game using the redeemRewardsGame function
  /// @dev Swaps vaultCurrency to Derby tokens, sends the funds to the user, and resets the allowance
  /// @param _deadline Timestamp after which the transaction is considered invalid
  /// @return value The amount of reward withdrawn by the user
  function withdrawRewards(
    uint256 _deadline,
    uint256 _minAmountOut
  ) external nonReentrant onlyWhenIdle returns (uint256 value) {
    UserInfo storage user = userInfo[msg.sender];
    require(user.rewardAllowance > 0, allowanceError);
    require(rebalancingPeriod > user.rewardRequestPeriod, noFundsError);

    value = user.rewardAllowance;
    value = checkForBalance(value);

    reservedFunds -= value;
    delete user.rewardAllowance;
    delete user.rewardRequestPeriod;

    if (swapRewards) {
      uint256 tokensReceived = Swap.swapTokensMulti(
        Swap.SwapInOut(
          value,
          _deadline,
          _minAmountOut,
          nativeToken,
          address(vaultCurrency),
          derbyToken
        ),
        controller.getUniswapParams(),
        true
      );
      IERC20(derbyToken).safeTransfer(msg.sender, tokensReceived);
    } else {
      vaultCurrency.safeTransfer(msg.sender, value);
    }
  }

  /// @notice Sometimes when swapping stable coins the vault will get a fraction of a coin less then expected
  /// @notice This is to make sure the vault doesnt get stuck
  /// @notice Value will be set to the vaultBalance
  /// @notice When divergence is greater then maxDivergenceWithdraws it will revert
  /// @param _value Value the user wants to withdraw
  /// @return value Value - divergence
  function checkForBalance(uint256 _value) internal view returns (uint256) {
    if (_value > getVaultBalance()) {
      uint256 oldValue = _value;
      _value = getVaultBalance();
      require(oldValue - _value <= maxDivergenceWithdraws, "Max divergence");
    }
    return _value;
  }

  /// @notice Step 3 trigger; Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests to xChainController
  /// @notice Pushes totalUnderlying, totalSupply and totalWithdrawalRequests of the vault for this chainId to xController
  function pushTotalUnderlyingToController() external payable onlyWhenIdle {
    require(rebalanceNeeded(), "!rebalance needed");

    rebalancingPeriod++;
    setTotalUnderlying();
    uint256 underlying = savedTotalUnderlying +
      getVaultBalance() -
      reservedFunds -
      totalDepositRequests;

    IXProvider(xProvider).pushTotalUnderlying{value: msg.value}(
      vaultNumber,
      homeChain,
      underlying,
      totalSupply(),
      totalWithdrawalRequests
    );

    state = State.PushedUnderlying;
    lastTimeStamp = block.timestamp;

    emit PushTotalUnderlying(
      vaultNumber,
      homeChain,
      underlying,
      totalSupply(),
      totalWithdrawalRequests
    );
  }

  /// @notice See setXChainAllocationInt below
  function setXChainAllocation(
    uint256 _amountToSend,
    uint256 _exchangeRate,
    bool _receivingFunds
  ) external onlyXProvider {
    require(state == State.PushedUnderlying, stateError);
    setXChainAllocationInt(_amountToSend, _exchangeRate, _receivingFunds);
  }

  /// @notice Step 4 end; xChainController pushes exchangeRate and amount the vaults have to send back to all vaults
  /// @notice Will set the amount to send back to the xController by the xController
  /// @dev Sets the amount and state so the dao can trigger the rebalanceXChain function
  /// @dev When amount == 0 the vault doesnt need to send anything and will wait for funds from the xController
  /// @param _amountToSend amount to send in vaultCurrency
  function setXChainAllocationInt(
    uint256 _amountToSend,
    uint256 _exchangeRate,
    bool _receivingFunds
  ) internal {
    amountToSendXChain = _amountToSend;
    exchangeRate = _exchangeRate;

    if (_amountToSend == 0 && !_receivingFunds) settleReservedFunds();
    else if (_amountToSend == 0 && _receivingFunds) state = State.WaitingForFunds;
    else state = State.SendingFundsXChain;
  }

  /// @notice Step 5 trigger; Push funds from vaults to xChainController
  /// @notice Send vaultcurrency to the xController for xChain rebalance
  function rebalanceXChain() external payable {
    require(state == State.SendingFundsXChain, stateError);

    if (amountToSendXChain > getVaultBalance()) pullFunds(amountToSendXChain);
    if (amountToSendXChain > getVaultBalance()) amountToSendXChain = getVaultBalance();

    vaultCurrency.safeIncreaseAllowance(xProvider, amountToSendXChain);
    IXProvider(xProvider).xTransferToController{value: msg.value}(
      vaultNumber,
      amountToSendXChain,
      address(vaultCurrency)
    );

    emit RebalanceXChain(vaultNumber, amountToSendXChain, address(vaultCurrency));

    amountToSendXChain = 0;
    settleReservedFunds();
  }

  /// @notice Step 6 end; Push funds from xChainController to vaults
  /// @notice Receiving feedback from xController when funds are received, so the vault can rebalance
  function receiveFunds() external onlyXProvider {
    if (state != State.WaitingForFunds) return;
    settleReservedFunds();
  }

  /// @notice Helper to settle reserved funds when funds arrived and up to the next State
  function settleReservedFunds() internal {
    reservedFunds += totalWithdrawalRequests;
    totalWithdrawalRequests = 0;
    if (vaultOff) state = State.SendRewardsPerToken;
    else state = State.RebalanceVault;
  }

  /// @notice See receiveProtocolAllocations below
  function receiveProtocolAllocations(int256[] memory _deltas) external onlyXProvider {
    receiveProtocolAllocationsInt(_deltas);
  }

  /// @notice Step 7 end; Game pushes deltaAllocations to vaults
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

  /// @notice Step 9 trigger; Vaults push rewardsPerLockedToken to game
  function sendRewardsToGame() external payable {
    require(state == State.SendRewardsPerToken, stateError);

    int256[] memory rewards = rewardsToArray();
    IXProvider(xProvider).pushRewardsToGame{value: msg.value}(vaultNumber, homeChain, rewards);

    state = State.Idle;

    emit PushedRewardsToGame(vaultNumber, homeChain, rewards);
  }

  /// @notice Step 2: Receive feedback for the vault if the vault is set to on or off
  /// @param _state bool for chainId on or off
  function toggleVaultOnOff(bool _state) external onlyXProvider {
    vaultOff = _state;
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

  /// @notice Setter for new game address
  /// @param _game New address of the game
  function setGame(address _game) external onlyDao {
    game = _game;
  }

  /// @notice Setter for swapping rewards to derby tokens
  /// @param _state True when rewards should be swapped to derby tokens
  function setSwapRewards(bool _state) external onlyDao {
    swapRewards = _state;
  }

  /// @notice Setter for maximum divergence a user can get during a withdraw
  /// @param _maxDivergence New maximum divergence in vaultCurrency
  function setMaxDivergence(uint256 _maxDivergence) external onlyDao {
    maxDivergenceWithdraws = _maxDivergence;
  }

  /*
  Only Guardian functions
  */

  /// @notice Step 4: Guardian function
  function setXChainAllocationGuard(
    uint256 _amountToSend,
    uint256 _exchangeRate,
    bool _receivingFunds
  ) external onlyGuardian {
    setXChainAllocationInt(_amountToSend, _exchangeRate, _receivingFunds);
  }

  /// @notice Step 6: Guardian function
  function receiveFundsGuard() external onlyGuardian {
    settleReservedFunds();
  }

  /// @notice Step 7: Guardian function
  function receiveProtocolAllocationsGuard(int256[] memory _deltas) external onlyGuardian {
    receiveProtocolAllocationsInt(_deltas);
  }

  /// @notice Guardian function to set state when vault gets stuck for whatever reason
  function setVaultStateGuard(State _state) external onlyGuardian {
    state = _state;
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
}
