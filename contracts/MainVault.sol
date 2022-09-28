// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Vault.sol";

import "hardhat/console.sol";


contract MainVault is Vault, VaultToken {
  using SafeERC20 for IERC20;
  
  // total amount of withdrawal requests for the vault to pull extra during a cross-chain rebalance, will be upped when a user makes a withdrawalRequest
  // during a cross-chain rebalance the vault will pull extra funds by the amount of totalWithdrawalRequests and the totalWithdrawalRequests will turn into actual reservedFunds
  uint256 internal totalWithdrawalRequests;
  // total amount of funds the vault reserved for users that made a withdrawalRequest
  uint256 internal reservedFunds;

  uint256 public exchangeRate;
  uint16 public homeChainId;
  uint256 public amountToSendXChain;
    
  // amount in vaultCurrency the vault owes to the user 
  mapping(address => uint256) internal withdrawalAllowance;
  // rebalancing period the withdrawal request is made
  mapping(address => uint256) internal withdrawalRequestPeriod;
  // exchangerate of the vault for a given rebalancingPeriod
  mapping(uint256 => uint256) public exchangeRatePerPeriod;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    string memory _vaultName,
    uint256 _vaultNumber,
    address _governed,
    address _game, 
    address _controller, 
    address _vaultCurrency,
    uint256 _uScale,
    uint256 _gasFeeLiquidity
  ) 
  VaultToken(_name, _symbol, _decimals) 
  Vault(_vaultName, _vaultNumber, _governed, _game, _controller, _vaultCurrency, _uScale, _gasFeeLiquidity) {
    exchangeRate = _uScale;
  }

  modifier onlyXProvider {
    require(msg.sender == xProvider, "Vault: only xProvider");
    _;
  }
  
  /// @notice Deposit in Vault
  /// @dev Deposit VaultCurrency to Vault and mint LP tokens
  /// @param _amount Amount to deposit
  /// @return shares Tokens received by buyer
  function deposit(uint256 _amount) external nonReentrant returns(uint256 shares) {
    uint256 balanceBefore = getVaultBalance();
    vaultCurrency.safeTransferFrom(msg.sender, address(this), _amount);
    uint256 balanceAfter = getVaultBalance();

    uint256 amount = balanceAfter - balanceBefore;
    shares = amount * (10 ** decimals()) / exchangeRate;
    
    _mint(msg.sender, shares); 
  }

  /// @notice Withdraw from Vault
  /// @dev Withdraw VaultCurrency from Vault and burn LP tokens
  /// @param _amount Amount to withdraw in LP tokens
  /// @param _pullFunds True when the user wants to pull funds from available protocols (higher gas fee)
  /// @return value Amount received by seller in vaultCurrency
  function withdraw(uint256 _amount, bool _pullFunds) external nonReentrant returns(uint256 value) {
    value = _amount * exchangeRate / (10 ** decimals());
    require(value > 0, "No value");

    if (_pullFunds && value > getVaultBalance()) pullFunds(value);  
    require(getVaultBalance() >= value, "Not enough funds");

    _burn(msg.sender, _amount);
    vaultCurrency.safeTransfer(msg.sender, value);
  }

  /// @notice Withdrawal request for when the vault doesnt have enough funds available
  /// @dev Will give the user allowance for his funds and pulls the extra funds at the next rebalance
  /// @param _amount Amount to withdraw in LP token
  function withdrawalRequest(uint256 _amount) external nonReentrant returns(uint256 value) {
    require(state == State.Idle, "Vault is rebalancing");
    require(withdrawalRequestPeriod[msg.sender] == 0, "Already a withdrawal request open");

    value = _amount * exchangeRate / (10 ** decimals());

    _burn(msg.sender, _amount);

    withdrawalAllowance[msg.sender] = value;
    withdrawalRequestPeriod[msg.sender] = rebalancingPeriod;
    totalWithdrawalRequests += value;
  }

  /// @notice Withdraw the allowance the user requested on the last rebalancing period
  /// @dev Will send the user funds and reset the allowance
  function withdrawAllowance() external nonReentrant returns(uint256 value) {
    require(state == State.Idle, "Vault is rebalancing");
    require(withdrawalAllowance[msg.sender] > 0, "No allowance");
    require(rebalancingPeriod > withdrawalRequestPeriod[msg.sender], "Funds not reserved yet");
    
    value = withdrawalAllowance[msg.sender];

    require(vaultCurrency.balanceOf(address(this)) >= value, "Not enough funds");

    reservedFunds -= value;
    delete withdrawalAllowance[msg.sender];
    delete withdrawalRequestPeriod[msg.sender];

    vaultCurrency.safeTransfer(msg.sender, value);
  }

  /// @notice Step 2 trigger; Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests to xChainController
  /// @notice Pushes totalUnderlying, totalSupply and totalWithdrawalRequests of the vault for this chainId to xController
  function pushTotalUnderlyingToController() external {
    require(state == State.Idle, "Vault already rebalancing");

    setTotalUnderlying();
    uint256 underlying = savedTotalUnderlying + getVaultBalance();

    IXProvider(xProvider).pushTotalUnderlying(
      vaultNumber, 
      homeChainId, 
      underlying, 
      totalSupply(), 
      totalWithdrawalRequests
    );

    state = State.PushedUnderlying;
  }

  /// @notice Step 3 end; xChainController pushes exchangeRate and amount the vaults have to send back to all vaults
  /// @notice Will set the amount to send back to the xController by the xController
  /// @dev Sets the amount and state so the dao can trigger the rebalanceXChain function
  /// @dev When amount == 0 the vault doesnt need to send anything and will wait for funds from the xController
  /// @param _amountToSend amount to send in vaultCurrency
  function setXChainAllocation(uint256 _amountToSend, uint256 _exchangeRate) external {
    amountToSendXChain = _amountToSend;
    exchangeRate = _exchangeRate;

    if (_amountToSend == 0) state = State.WaitingForFunds;
    else state = State.SendingFundsXChain;
  }

  /// @notice Step 4 trigger; Push funds from vaults to xChainController
  /// @notice Send vaultcurrency to the xController for xChain rebalance
  function rebalanceXChain() external {
    if (state != State.SendingFundsXChain) return;

    if (amountToSendXChain > getVaultBalance()) pullFunds(amountToSendXChain);  

    vaultCurrency.safeIncreaseAllowance(xProvider, amountToSendXChain);
    IXProvider(xProvider).xTransferToController(vaultNumber, amountToSendXChain, vaultCurrencyAddr);
    
    amountToSendXChain = 0;
    state = State.RebalanceVault;
  }

  /// @notice Step 5 end; Push funds from xChainController to vaults
  /// @notice Receiving feedback from xController when funds are received, so the vault can rebalance
  function receiveFunds() external onlyXProvider {
    if (state != State.WaitingForFunds) return;
    state = State.RebalanceVault;
  }

  /// @notice Step 6 end; Game pushes deltaAllocations to vaults
  /// @notice Receives protocol allocation array from the game and settles the allocations
  /// @param _deltas Array with delta allocations where the index matches the protocolId
  function receiveProtocolAllocations(int256[] memory _deltas) external onlyXProvider {
    for (uint i = 0; i < _deltas.length; i++) {
      int256 allocation = _deltas[i];
      if (allocation == 0) continue;
      setDeltaAllocationsInt(i, allocation);
    }

    deltaAllocationsReceived = true;
  }

  /// @notice Step 8 trigger; Vaults push rewardsPerLockedToken to game
  function sendRewardsToGame() external {
    require(state == State.SendRewardsPerToken , "Wrong state");

    int256[] memory rewards = rewardsToArray();
    IXProvider(xProvider).pushRewardsToGame(vaultNumber, homeChainId, rewards);

    state = State.Idle;
  }

  /// @notice Exchange rate of Vault LP Tokens in VaultCurrency per LP token (e.g. 1 LP token = $2).
  /// @return Price per share of LP Token
  // function exchangeRate() public view returns(uint256) {
  //   return exchangeRate;
  // }

  /// @notice Returns the amount in vaultCurrency the user is able to withdraw
  function getWithdrawalAllowance() external view returns(uint256) {
    return withdrawalAllowance[msg.sender];
  }

  function getVaultBalance() public override view returns(uint256) {
    return vaultCurrency.balanceOf(address(this)) - reservedFunds;
  }

  /// @notice Setter for xProvider address
  /// @param _xProvider new address of xProvider on this chain
  function setHomeXProviderAddress(address _xProvider) external onlyDao {
    xProvider = _xProvider;
  }

  /// @notice Setter for xController address
  /// @param _xController set controller address
  function setXControllerAddress(address _xController) external onlyDao {
    xController = _xController;
  }

  /// @notice Setter for xController chainId and homeChain
  function setChainIds(uint16 _homeChain) external onlyDao {
    homeChainId = _homeChain;
  }
}