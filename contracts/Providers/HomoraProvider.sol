// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/IHomora.sol";
import "../Interfaces/IProvider.sol";

import "hardhat/console.sol";

contract HomoraProvider is IProvider {
  using SafeERC20 for IERC20;

  address public controller;

  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyController() {
    require(msg.sender == controller, "ETFProvider: only controller");
    _;
  }

  constructor(address _controller) {
    controller = _controller;
  }

  /// @notice Deposit the underlying asset in Homora
  /// @dev Pulls underlying asset from Vault, deposit them in Homora, send tTokens back.
  /// @param _vault Address from Vault contract i.e buyer
  /// @param _amount Amount to deposit
  /// @param _hToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Tokens received and sent to vault
  function deposit(
    address _vault,
    uint256 _amount,
    address _hToken,
    address _uToken
  ) external override onlyController returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    IERC20(_uToken).safeTransferFrom(_vault, address(this), _amount);
    IERC20(_uToken).safeIncreaseAllowance(_hToken, _amount);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    uint256 hTokenBefore = IHomora(_hToken).balanceOf(address(this));
    IHomora(_hToken).deposit(_amount);
    uint256 hTokenAfter = IHomora(_hToken).balanceOf(address(this));

    uint hTokensReceived = hTokenAfter - hTokenBefore;
    IHomora(_hToken).transfer(_vault, hTokensReceived);

    return hTokensReceived;
  }

  /// @notice Withdraw the underlying asset from Homora
  /// @dev Pulls tTokens from Vault, redeem them from Homora, send underlying back.
  /// @param _vault Address from Vault contract i.e buyer
  /// @param _amount Amount to withdraw
  /// @param _hToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(
    address _vault,
    uint256 _amount,
    address _hToken,
    address _uToken
  ) external override onlyController returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(_vault);

    uint256 balanceBeforeRedeem = IERC20(_uToken).balanceOf(address(this));

    require(
      IHomora(_hToken).transferFrom(_vault, address(this), _amount) == true,
      "Error: transferFrom"
    );
    IHomora(_hToken).withdraw(_amount);

    uint256 balanceAfterRedeem = IERC20(_uToken).balanceOf(address(this));
    uint256 uTokensReceived = balanceAfterRedeem - balanceBeforeRedeem;

    IERC20(_uToken).safeTransfer(_vault, uTokensReceived);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(_vault);
    require(
      (balanceAfter - balanceBefore - uTokensReceived) == 0,
      "Error Withdraw: under/overflow"
    );

    return uTokensReceived;
  }

  /// @notice Get balance from address in underlying token
  /// @dev balance = poolvalue * shares / totalsupply
  /// @param _address Address to request balance from, most likely an Vault
  /// @param _hToken Address of protocol LP Token eg cUSDC
  /// @return balance in underlying token
  function balanceUnderlying(address _address, address _hToken)
    public
    view
    override
    returns (uint256)
  {
    // uint256 shares = balance(_address, _hToken);
    // uint256 balance = IHomora(_hToken).poolValue() * shares / IHomora(_hToken).totalSupply();
    // return balance;
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev shares = totalsupply * balance / poolvalue
  /// @param _amount Amount in underyling token e.g USDC
  /// @param _hToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount, address _hToken) external view override returns (uint256) {
    // uint256 shares = IHomora(_hToken).totalSupply() * _amount / IHomora(_hToken).poolValue();
    // return shares;
  }

  /// @notice Get balance of cToken from address
  /// @param _address Address to request balance from
  /// @param _hToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function balance(address _address, address _hToken) public view override returns (uint256) {
    return IHomora(_hToken).balanceOf(_address);
  }

  // not used by Homora, can maybe deleted everywhere?
  function exchangeRate(address _tToken) public view override returns (uint256) {}

  function claim(address _tToken, address _claimer) external override returns (bool) {}
}
