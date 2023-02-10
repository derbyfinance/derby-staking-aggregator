// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "./Vault.sol";

import "./Interfaces/IXProvider.sol";

import "hardhat/console.sol";

contract MainVault is Vault, VaultToken {
  using SafeERC20 for IERC20;

  struct UserInfo {
    // amount in vaultCurrency the vault owes to the user
    uint256 withdrawalAllowance;
    // rebalancing period the withdrawal request is made
    uint256 withdrawRequestPeriod;
    // amount in vaultCurrency the vault owes to the user
    uint256 rewardAllowance;
    // rebalancing period the reward request is made
    uint256 rewardRequestPeriod;
  }

  address public derbyToken;
  address public game;
  address public xProvider;

  bool public vaultOff;
  // True when rewards should be swapped to derby tokens
  bool public swapRewards;

  // total amount of withdrawal requests for the vault to pull extra during a cross-chain rebalance, will be upped when a user makes a withdrawalRequest
  // during a cross-chain rebalance the vault will pull extra funds by the amount of totalWithdrawalRequests and the totalWithdrawalRequests will turn into actual reservedFunds
  uint256 internal totalWithdrawalRequests;
  uint256 public exchangeRate;
  uint16 public homeChain;
  uint256 public amountToSendXChain;
  uint256 public governanceFee; // Basis points

  string internal stateError = "Wrong state";

  // (userAddress => userInfo struct)
  mapping(address => UserInfo) internal user;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _vaultNumber,
    address _dao,
    address _game,
    address _controller,
    address _vaultCurrency,
    uint256 _uScale
  )
    VaultToken(_name, _symbol, _decimals)
    Vault(_vaultNumber, _dao, _controller, _vaultCurrency, _uScale)
  {
    exchangeRate = _uScale;
    game = _game;
    governanceFee = 0;
  }

  modifier onlyXProvider() {
    require(msg.sender == xProvider, "only xProvider");
    _;
  }

  modifier onlyWhenVaultIsOn() {
    require(state == State.Idle, "Rebalancing");
    require(!vaultOff, "Vault is off");
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
    uint16 _chainId,
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  );
  event RebalanceXChain(uint256 _vaultNumber, uint256 _amount, address _asset);
  event PushedRewardsToGame(uint256 _vaultNumber, uint16 _chain, int256[] _rewards);

  /// @notice Deposit in Vault
  /// @dev Deposit VaultCurrency to Vault and mint LP tokens
  /// @param _amount Amount to deposit
  /// @param _receiver Receiving adress for the tokens
  /// @return shares Tokens received by buyer
  function deposit(
    uint256 _amount,
    address _receiver
  ) external nonReentrant onlyWhenVaultIsOn returns (uint256 shares) {
    uint256 balanceBefore = getVaultBalance();
    vaultCurrency.safeTransferFrom(msg.sender, address(this), _amount);
    uint256 balanceAfter = getVaultBalance();

    uint256 amount = balanceAfter - balanceBefore;
    shares = (amount * (10 ** decimals())) / exchangeRate;

    _mint(_receiver, shares);
  }

  /// @notice Withdraw from Vault
  /// @dev Withdraw VaultCurrency from Vault and burn LP tokens
  /// @param _amount Amount to withdraw in LP tokens
  /// @param _receiver Receiving adress for the vaultcurrency
  /// @return value Amount received by seller in vaultCurrency
  function withdraw(
    uint256 _amount,
    address _receiver,
    address _owner
  ) external nonReentrant onlyWhenVaultIsOn returns (uint256 value) {
    value = (_amount * exchangeRate) / (10 ** decimals());

    require(value > 0, "!value");

    require(getVaultBalance() >= value, "!funds");

    _burn(msg.sender, _amount);
    transferFunds(_receiver, value);
  }

  /// @notice Withdrawal request for when the vault doesnt have enough funds available
  /// @dev Will give the user allowance for his funds and pulls the extra funds at the next rebalance
  /// @param _amount Amount to withdraw in LP token
  function withdrawalRequest(
    uint256 _amount
  ) external nonReentrant onlyWhenVaultIsOn returns (uint256 value) {
    require(user[msg.sender].withdrawalRequestPeriod == 0, "Already a request");

    value = (_amount * exchangeRate) / (10 ** decimals());

    _burn(msg.sender, _amount);

    withdrawalAllowance[msg.sender] = value;
    withdrawalRequestPeriod[msg.sender] = rebalancingPeriod;
    totalWithdrawalRequests += value;
  }

  /// @notice Withdraw the allowance the user requested on the last rebalancing period
  /// @dev Will send the user funds and reset the allowance
  function withdrawAllowance() external nonReentrant onlyWhenIdle returns (uint256 value) {
    require(withdrawalAllowance[msg.sender] > 0, "!allowance");
    require(rebalancingPeriod > withdrawalRequestPeriod[msg.sender], "Funds not arrived");

    value = withdrawalAllowance[msg.sender];

    require(vaultCurrency.balanceOf(address(this)) >= value, "!funds");

    reservedFunds -= value;
    delete withdrawalAllowance[msg.sender];
    delete withdrawalRequestPeriod[msg.sender];

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
  ) external onlyGame nonReentrant onlyWhenVaultIsOn {
    require(rewardAllowance[_user] == 0, "!allowance");

    rewardAllowance[_user] = _value;
    rewardRequestPeriod[_user] = rebalancingPeriod;
    totalWithdrawalRequests += _value;
  }

  /// @notice Withdraw the reward allowance set by the game with redeemRewardsGame
  /// @dev Will swap vaultCurrency to Derby tokens, send the user funds and reset the allowance
  function withdrawRewards() external nonReentrant onlyWhenIdle returns (uint256 value) {
    require(rewardAllowance[msg.sender] > 0, "!allowance");
    require(rebalancingPeriod > rewardRequestPeriod[msg.sender], "Funds not arrived");

    value = rewardAllowance[msg.sender];

    require(vaultCurrency.balanceOf(address(this)) >= value, "!funds");

    reservedFunds -= value;
    delete rewardAllowance[msg.sender];
    delete rewardRequestPeriod[msg.sender];

    if (swapRewards) {
      uint256 tokensReceived = Swap.swapTokensMulti(
        Swap.SwapInOut(value, address(vaultCurrency), derbyToken),
        controller.getUniswapParams(),
        true
      );
      IERC20(derbyToken).safeTransfer(msg.sender, tokensReceived);
    } else {
      vaultCurrency.safeTransfer(msg.sender, value);
    }
  }

  /// @notice Step 2 trigger; Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests to xChainController
  /// @notice Pushes totalUnderlying, totalSupply and totalWithdrawalRequests of the vault for this chainId to xController
  function pushTotalUnderlyingToController() external onlyWhenIdle {
    require(rebalanceNeeded(), "!rebalance needed");

    setTotalUnderlying();
    uint256 underlying = savedTotalUnderlying + getVaultBalance();

    IXProvider(xProvider).pushTotalUnderlying(
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
    uint256 _exchangeRate
  ) external onlyXProvider {
    require(state == State.PushedUnderlying, stateError);
    setXChainAllocationInt(_amountToSend, _exchangeRate);
  }

  /// @notice Step 3 end; xChainController pushes exchangeRate and amount the vaults have to send back to all vaults
  /// @notice Will set the amount to send back to the xController by the xController
  /// @dev Sets the amount and state so the dao can trigger the rebalanceXChain function
  /// @dev When amount == 0 the vault doesnt need to send anything and will wait for funds from the xController
  /// @param _amountToSend amount to send in vaultCurrency
  function setXChainAllocationInt(uint256 _amountToSend, uint256 _exchangeRate) internal {
    amountToSendXChain = _amountToSend;
    exchangeRate = _exchangeRate;

    if (_amountToSend == 0) state = State.WaitingForFunds;
    else state = State.SendingFundsXChain;
  }

  /// @notice Step 4 trigger; Push funds from vaults to xChainController
  /// @notice Send vaultcurrency to the xController for xChain rebalance
  function rebalanceXChain() external {
    require(state == State.SendingFundsXChain, stateError);

    if (amountToSendXChain > getVaultBalance()) pullFunds(amountToSendXChain);
    if (amountToSendXChain > getVaultBalance()) amountToSendXChain = getVaultBalance();

    vaultCurrency.safeIncreaseAllowance(xProvider, amountToSendXChain);
    IXProvider(xProvider).xTransferToController(
      vaultNumber,
      amountToSendXChain,
      address(vaultCurrency)
    );

    emit RebalanceXChain(vaultNumber, amountToSendXChain, address(vaultCurrency));

    amountToSendXChain = 0;
    settleReservedFunds();
  }

  /// @notice Step 5 end; Push funds from xChainController to vaults
  /// @notice Receiving feedback from xController when funds are received, so the vault can rebalance
  function receiveFunds() external onlyXProvider {
    if (state != State.WaitingForFunds) return;
    settleReservedFunds();
  }

  /// @notice Helper to settle reserved funds when funds arrived and up to the next State
  function settleReservedFunds() internal {
    reservedFunds += totalWithdrawalRequests;
    totalWithdrawalRequests = 0;
    state = State.RebalanceVault;
  }

  /// @notice See receiveProtocolAllocations below
  function receiveProtocolAllocations(int256[] memory _deltas) external onlyXProvider {
    receiveProtocolAllocationsInt(_deltas);
  }

  /// @notice Step 6 end; Game pushes deltaAllocations to vaults
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

  /// @notice Step 8 trigger; Vaults push rewardsPerLockedToken to game
  function sendRewardsToGame() external {
    require(state == State.SendRewardsPerToken, stateError);

    int256[] memory rewards = rewardsToArray();
    IXProvider(xProvider).pushRewardsToGame(vaultNumber, homeChain, rewards);

    state = State.Idle;

    emit PushedRewardsToGame(vaultNumber, homeChain, rewards);
  }

  /// @notice Receive feedback for the vault if the vault is set to on or off
  /// @param _state bool for chainId on or off
  function toggleVaultOnOff(bool _state) external onlyXProvider {
    vaultOff = _state;
  }

  /// @notice Returns the amount in vaultCurrency the user is able to withdraw
  function getWithdrawalAllowance() external view returns (uint256) {
    return withdrawalAllowance[msg.sender];
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

  /*
  Only Guardian functions
  */

  /// @notice Step 3: Guardian function
  function setXChainAllocationGuard(
    uint256 _amountToSend,
    uint256 _exchangeRate
  ) external onlyGuardian {
    setXChainAllocationInt(_amountToSend, _exchangeRate);
  }

  /// @notice Step 5: Guardian function
  function receiveFundsGuard() external onlyGuardian {
    settleReservedFunds();
  }

  /// @notice Step 6: Guardian function
  function receiveProtocolAllocationsGuard(int256[] memory _deltas) external onlyGuardian {
    receiveProtocolAllocationsInt(_deltas);
  }

  /// @notice Guardian function to set state when vault gets stuck for whatever reason
  function setVaultStateGuard(State _state) external onlyGuardian {
    state = _state;
  }

  /// @notice Setter for new homeChain Id
  function setHomeChain(uint16 _homeChain) external onlyGuardian {
    homeChain = _homeChain;
  }

  /// @notice Setter for governance fee
  /// @param _fee Fee in basis points
  function setGovernanceFee(uint16 _fee) external onlyGuardian {
    governanceFee = _fee;
  }
}
