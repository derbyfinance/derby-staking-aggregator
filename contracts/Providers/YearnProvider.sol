// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/IYearn.sol";
import "../Interfaces/IProvider.sol";

contract YearnProvider is IProvider {
  using SafeERC20 for IERC20;

  address private dao;

  // (vaultAddress => bool): true when address is whitelisted
  mapping(address => bool) public vaultWhitelist;

  modifier onlyDao() {
    require(msg.sender == dao, "Provider: only DAO");
    _;
  }

  modifier onlyVault() {
    require(vaultWhitelist[msg.sender] == true, "Provider: only Vault");
    _;
  }

  constructor(address _dao) {
    dao = _dao;
  }

  /// @notice Add protocol and vault to Controller
  /// @param _vault Vault address to whitelist
  function addVault(address _vault) external onlyDao {
    vaultWhitelist[_vault] = true;
  }

  /// @notice Getter for dao address
  function getDao() public view returns (address) {
    return dao;
  }

  /// @notice Deposit the underlying asset in Yearn
  /// @dev Pulls underlying asset from Vault, deposit them in Yearn, send yTokens back.
  /// @param _amount Amount to deposit
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Tokens received and sent to vault
  function deposit(
    uint256 _amount,
    address _yToken,
    address _uToken
  ) external override onlyVault returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    IERC20(_uToken).safeTransferFrom(msg.sender, address(this), _amount);
    IERC20(_uToken).safeIncreaseAllowance(_yToken, _amount);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    uint256 yTokenReceived = IYearn(_yToken).deposit(_amount);
    IYearn(_yToken).transfer(msg.sender, yTokenReceived);

    return yTokenReceived;
  }

  /// @notice Withdraw the underlying asset from Yearn
  /// @dev Pulls cTokens from Vault, redeem them from Yearn, send underlying back.
  /// @param _amount Amount to withdraw
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(
    uint256 _amount,
    address _yToken,
    address _uToken
  ) external override onlyVault returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(msg.sender);
    uint256 sharesBefore = IERC20(_yToken).balanceOf(address(this));

    require(
      IYearn(_yToken).transferFrom(msg.sender, address(this), _amount) == true,
      "Error transferFrom"
    );

    uint256 uAmountReceived = IYearn(_yToken).withdraw(_amount);
    IERC20(_uToken).safeTransfer(msg.sender, uAmountReceived);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(msg.sender);
    require(
      (balanceAfter - balanceBefore - uAmountReceived) == 0,
      "Error Withdraw: under/overflow"
    );

    uint256 sharesAfter = IERC20(_yToken).balanceOf(address(this));
    if (sharesAfter > sharesBefore) {
      IERC20(_yToken).safeTransfer(msg.sender, sharesAfter - sharesBefore);
    }

    return uAmountReceived;
  }

  /// @notice Get balance from address in shares i.e LP tokens
  /// @param _address Address to request balance from, most likely an Vault
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @return Balance in VaultCurrency e.g USDC
  function balanceUnderlying(
    address _address,
    address _yToken
  ) public view override returns (uint256) {
    uint256 balanceShares = balance(_address, _yToken);
    uint256 price = exchangeRate(_yToken);
    return (balanceShares * price) / 10 ** IYearn(_yToken).decimals();
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev Yearn scales price by 1E6
  /// @param _amount Amount in underyling token e.g USDC
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount, address _yToken) external view override returns (uint256) {
    uint256 shares = (_amount * (10 ** IYearn(_yToken).decimals())) / exchangeRate(_yToken);
    return shares;
  }

  /// @notice Get balance of yToken from address
  /// @param _address Address to request balance from
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @return number of shares i.e LP tokens
  function balance(address _address, address _yToken) public view override returns (uint256) {
    uint256 balanceShares = IYearn(_yToken).balanceOf(_address);
    return balanceShares;
  }

  /// @notice Exchange rate of underyling protocol token
  /// @param _yToken Address of protocol LP Token eg yUSDC
  /// @return price of LP token
  function exchangeRate(address _yToken) public view override returns (uint256) {
    uint256 price = IYearn(_yToken).pricePerShare();
    return price;
  }

  /// @dev Transfers a specified amount of tokens to a specified vault, used for getting rewards out.
  /// This function can only be called by the DAO.
  /// @param _token The address of the token to be transferred.
  /// @param _vault The address of the vault to receive the tokens.
  /// @param _amount The amount of tokens to be transferred.
  function sendTokensToVault(address _token, address _vault, uint256 _amount) external onlyDao {
    require(vaultWhitelist[_vault] == true, "Provider: Vault not known");
    IERC20(_token).safeTransfer(_vault, _amount);
  }

  function claim(address _yToken, address _claimer) public override onlyVault returns (bool) {}
}
