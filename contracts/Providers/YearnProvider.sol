// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/IYearn.sol";
import "../Interfaces/IProvider.sol";

import "hardhat/console.sol";

contract YearnProvider is IProvider{
  using SafeERC20 for IERC20;
  
  address public controller; 
  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyController {
    require(msg.sender == controller, "ETFProvider: only controller");
    _;
  }

  constructor(address _controller) {
    controller = _controller;
  }

  /// @notice Deposit the underlying asset in Yearn
  /// @dev Pulls underlying asset from ETFVault, deposit them in Yearn, send yTokens back.
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to deposit
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Tokens received and sent to vault
  function deposit(
    address _vault, 
    uint256 _amount,
    address _yToken,
    address _uToken
  ) external override onlyController returns(uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    IERC20(_uToken).safeTransferFrom(_vault, address(this), _amount);
    IERC20(_uToken).safeIncreaseAllowance(_yToken, _amount);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    uint256 yTokenReceived = IYearn(_yToken).deposit(_amount);
    IYearn(_yToken).transfer(_vault, yTokenReceived);

    return yTokenReceived;
  }

  /// @notice Withdraw the underlying asset from Yearn
  /// @dev Pulls cTokens from ETFVault, redeem them from Yearn, send underlying back.
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to withdraw
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(
    address _vault, 
    uint256 _amount,
    address _yToken,
    address _uToken
  ) external override onlyController returns(uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(_vault); 

    require(IYearn(_yToken).transferFrom(_vault, address(this), _amount) == true, "Error transferFrom");

    uint256 uAmountReceived = IYearn(_yToken).withdraw(_amount); 
    IERC20(_uToken).safeTransfer(_vault, uAmountReceived);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(_vault); 
    require((balanceAfter - balanceBefore - uAmountReceived) == 0, "Error Withdraw: under/overflow");

    return uAmountReceived;
  }

  /// @notice Get balance from address in shares i.e LP tokens
  /// @param _address Address to request balance from, most likely an ETFVault
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @return Balance in VaultCurrency e.g USDC
  function balanceUnderlying(address _address, address _yToken) public view override returns (uint256) {
    uint256 balanceShares = balance(_address, _yToken);
    uint256 price = exchangeRate(_yToken);
    return balanceShares * price / 10 ** IYearn(_yToken).decimals();
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev Yearn scales price by 1E6
  /// @param _amount Amount in underyling token e.g USDC
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount, address _yToken) external view override returns (uint256) {
    uint256 shares = _amount  * 1E6 / exchangeRate(_yToken);
    return shares;
  }

  /// @notice Get balance of yToken from address
  /// @param _address Address to request balance from
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @return number of shares i.e LP tokens
  function balance(address _address, address _yToken) public view override returns (uint256) {
    uint256 _balanceShares = IYearn(_yToken).balanceOf(_address);
    return _balanceShares;
  }

  /// @notice Exchange rate of underyling protocol token
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @return price of LP token
  function exchangeRate(address _yToken) public view override returns(uint256) {
    uint256 _price = IYearn(_yToken).pricePerShare();
    return _price;
  }

  function claim(address _yToken, address _claimer) public override returns(bool) {

  }
}