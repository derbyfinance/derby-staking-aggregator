// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "./Vault.sol";

import "./Interfaces/IXProvider.sol";

contract MainVault is Vault {
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

  uint32 public homeChain;
  uint256 public governanceFee; // Basis points
  uint256 public maxDivergenceWithdraws;
  uint256 public minimumDeposit;
  uint256 public lastRewardPeriod;

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
    Vault(_name, _symbol, _decimals, _vaultNumber, _dao, _controller, _vaultCurrency, _nativeToken)
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

  modifier onlyGame() {
    require(msg.sender == game, "only game");
    _;
  }

  event PushedRewardsToGame(uint256 _vaultNumber, uint32 _chain, int256[] _rewards);

  /// @notice Enables a user to make a deposit into the Vault.
  /// @dev This function allows a user to deposit an amount greater than or equal to the minimum deposit,
  /// transfers the deposited amount from the user to the Vault, and records the deposit request.
  /// If the training mode is active, the function checks if the user is whitelisted and the deposit doesn't exceed the max training deposit.
  /// @param _amount The amount that the user wants to deposit.
  function deposit(uint256 _amount) external nonReentrant {
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

  /// @notice Withdrawal request for when the vault doesnt have enough funds available
  /// @dev Will give the user allowance for his funds and pulls the extra funds at the next rebalance
  /// @param _amount Amount to withdraw in LP token, in LPtoken.decimals()
  /// @return value Amount received by seller in vaultCurrency, in vaultcurrency.decimals()
  function withdrawalRequest(uint256 _amount) external nonReentrant returns (uint256 value) {
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
  function withdrawAllowance() external nonReentrant returns (uint256 value) {
    UserInfo storage user = userInfo[msg.sender];
    require(user.withdrawalAllowance > 0, allowanceError);
    require(rebalancingPeriod > user.withdrawalRequestPeriod, noFundsError);

    value = user.withdrawalAllowance;
    value = IXProvider(xProvider).calculateEstimatedAmount(value);
    value = checkForBalance(value);

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
  function redeemRewardsGame(uint256 _value, address _user) external onlyGame nonReentrant {
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
  ) external nonReentrant returns (uint256 value) {
    UserInfo storage user = userInfo[msg.sender];
    require(user.rewardAllowance > 0, allowanceError);
    require(rebalancingPeriod > user.rewardRequestPeriod, noFundsError);

    value = user.rewardAllowance;
    value = checkForBalance(value);
    totalWithdrawalRequests -= user.rewardAllowance;

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

  /// @notice Step 7: Guardian function
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
}
