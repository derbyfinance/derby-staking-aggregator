// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/ITruefi.sol";
import "../Interfaces/IProvider.sol";

import "hardhat/console.sol";

contract CompoundProvider is IProvider {
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

  /// @notice Deposit the underlying asset in Compound
  /// @dev Pulls underlying asset from ETFVault, deposit them in Compound, send cTokens back.
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to deposit
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Tokens received and sent to vault
  function deposit(
    address _vault, 
    uint256 _amount, 
    address _cToken,
    address _uToken
  ) external override onlyController returns(uint256) {
    // uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    // IERC20(_uToken).safeTransferFrom(_vault, address(this), _amount);
    // IERC20(_uToken).safeIncreaseAllowance(_cToken, _amount);

    // uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    // require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    // uint256 cTokenBefore = ICToken(_cToken).balanceOf(address(this));
    // require(ICToken(_cToken).mint(_amount) == 0, "Error minting Compound");
    // uint256 cTokenAfter = ICToken(_cToken).balanceOf(address(this));

    // uint cTokensReceived = cTokenAfter - cTokenBefore;
    // ICToken(_cToken).transfer(_vault, cTokensReceived);

    // return cTokensReceived;
  }

  /// @notice Withdraw the underlying asset from Compound
  /// @dev Pulls cTokens from ETFVault, redeem them from Compound, send underlying back.
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to withdraw
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(
    address _vault, 
    uint256 _amount, 
    address _cToken,
    address _uToken
  ) external override onlyController returns(uint256) {

  }

  /// @notice Get balance from address in underlying token
  /// @param _address Address to request balance from, most likely an ETFVault
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return balance in underlying token
  function balanceUnderlying(address _address, address _cToken) public view override returns(uint256) {

  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev returned price from compound is scaled by 1e18
  /// @param _amount Amount in underyling token e.g USDC
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount, address _cToken) external view override returns(uint256) {
  }

  /// @notice Get balance of cToken from address
  /// @param _address Address to request balance from
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function balance(address _address, address _cToken) public view override returns(uint256) {

  }

  /// @notice Exchange rate of underyling protocol token
  /// @dev returned price from compound is scaled by 1e18
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return price of LP token
  function exchangeRate(address _cToken) public view override returns(uint256) {

  }

  /// @notice Claims/harvest COMP tokens from the Comptroller
  /// @param _cToken Address of protocol LP Token eg cUSDC
  function claim(address _cToken, address _claimer) external override returns(bool) {

  }

  function getHistoricalPrice(uint256 _period) external view returns(uint256) {

  }

  function addPricePoint() external override {

  }

}