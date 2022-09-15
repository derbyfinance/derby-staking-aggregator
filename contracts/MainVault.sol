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
    uint256 totalSupply = totalSupply();

    if (totalSupply > 0) {
      shares = ( amount * totalSupply ) / ( savedTotalUnderlying + balanceBefore ); 
    } else {
      shares = amount; 
    }
    
    _mint(msg.sender, shares); 
  }

  /// @notice Withdrawal request for when the vault doesnt have enough funds available
  /// @dev Will give the user allowance for his funds and pulls the extra funds at the next rebalance
  /// @param _amount Amount to withdraw in LP tokens
  function withdrawalRequest(uint256 _amount) external nonReentrant {
    require(state == State.WaitingForController, "Vault is rebalancing");
    require(withdrawalRequestPeriod[msg.sender] == 0, "Already a withdrawal request open");

    _burn(msg.sender, _amount);

    withdrawalAllowance[msg.sender] = _amount;
    withdrawalRequestPeriod[msg.sender] = rebalancingPeriod;
    totalWithdrawalRequests += _amount;
  }

  /// @notice Withdraw the allowance the user requested on the last rebalancing period
  /// @dev Will send the user funds and reset the allowance
  function withdrawAllowance() external nonReentrant returns(uint256 value) {
    require(state == State.WaitingForController, "Vault is rebalancing");
    require(withdrawalAllowance[msg.sender] > 0, "No allowance");
    require(rebalancingPeriod > withdrawalRequestPeriod[msg.sender], "Funds not reserved yet");
    
    uint256 period = withdrawalRequestPeriod[msg.sender];
    uint256 price = exchangeRatePerPeriod[period + 1];
    value = withdrawalAllowance[msg.sender] * price / uScale;

    require(price > 0, "No exchangeRate");
    require(vaultCurrency.balanceOf(address(this)) >= value, "Not enough funds");

    reservedFunds -= value;
    delete withdrawalAllowance[msg.sender];
    delete withdrawalRequestPeriod[msg.sender];

    vaultCurrency.safeTransfer(msg.sender, value);
  }

  /// @notice Exchange rate of Vault LP Tokens in VaultCurrency per LP token (e.g. 1 LP token = $2).
  /// @return Price per share of LP Token
  function exchangeRate() public view returns(uint256) {
    if (totalSupply() == 0) return 1;
    return (savedTotalUnderlying + getVaultBalance())  * uScale / totalSupply();
  }

  /// @notice Returns the amount in vaultCurrency the user is able to withdraw
  function getWithdrawalAllowance() external view returns(uint256) {
    return withdrawalAllowance[msg.sender];
  }

  function getVaultBalance() public override view returns(uint256) {
    return vaultCurrency.balanceOf(address(this)) - reservedFunds;
  }
}