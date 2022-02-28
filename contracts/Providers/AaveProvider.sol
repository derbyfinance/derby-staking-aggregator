// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/IAToken.sol";
import "../Interfaces/ExternalInterfaces/IALendingPool.sol";
import "../Interfaces/IProvider.sol";

import "hardhat/console.sol";

contract AaveProvider is IProvider{
  using SafeERC20 for IERC20;

  IAToken public aToken; 
  address override public protocolToken;

  IERC20 public uToken; 
  address public uTokenAddr;

  uint16 private aaveReferral;
  address public router; 

  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyRouter {
    require(msg.sender == router, "ETFProvider: only router");
    _;
  }

  constructor(address _aToken, address _router) {
    aToken = IAToken(_aToken);
    protocolToken = _aToken;

    uTokenAddr = aToken.UNDERLYING_ASSET_ADDRESS();
    uToken = IERC20(uTokenAddr);
    
    router = _router;
    aaveReferral = 0;
  }

  // OnlyDao modifier? referral code for aave. Will not be used in the near future but nice to have.
  function setAaveReferral(uint16 _code) external {
    aaveReferral = _code;
  }

  /// @notice Deposit the underlying asset in Aave
  /// @dev Pulls underlying asset from ETFVault, deposit them in Aave, send aTokens back.
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to deposit
  /// @return Tokens received and sent to vault
  function deposit(address _vault, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(address(this));

    uToken.safeTransferFrom(_vault, address(this), _amount);
    uToken.safeIncreaseAllowance(address(aToken.POOL()), _amount);

    uint256 balanceAfter = uToken.balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error");

    IALendingPool(aToken.POOL()).deposit(uTokenAddr, _amount, _vault, aaveReferral);

    return _amount;
  }

  /// @notice Withdraw the underlying asset from Aave
  /// @dev Pulls cTokens from ETFVault, redeem them from Aave, send underlying back.
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to withdraw
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(address _vault, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(_vault); 

    require(aToken.transferFrom(_vault, address(this), _amount) == true, "Error");
    uint256 uTokensReceived = IALendingPool(aToken.POOL()).withdraw(uTokenAddr, _amount, _vault);

    uint256 balanceAfter = uToken.balanceOf(_vault); 

    require((balanceAfter - balanceBefore - uTokensReceived) == 0, "Error");

    return uTokensReceived;
  }

  /// @notice Get balance from address in shares i.e LP tokens
  /// @param _address Address to request balance from, most likely an ETFVault
  /// @return number of shares i.e LP tokens
  function balanceUnderlying(address _address) public override view returns (uint256) {
    uint256 balanceShares = balance(_address);
    return balanceShares;
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev Aave exchangeRate is 1
  /// @param _amount Amount in underyling token e.g USDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount) external view override returns (uint256) {
    uint256 shares = _amount / exchangeRate();

    return shares;
  }

  /// @notice Get balance of aToken from address
  /// @param _address Address to request balance from
  /// @return number of shares i.e LP tokens
  function balance(address _address) public view override returns (uint256) {
    uint256 _balanceShares = aToken.balanceOf(_address);
    return _balanceShares;
  }

  /// @notice Exchange rate of underyling protocol token
  /// @dev Aave exchangeRate is always 1
  /// @return price of LP token
  function exchangeRate() public pure override returns(uint256) {
    return 1;
  }

  function claim() public {
    
  }

  function getHistoricalPrice(uint256 _period) external override view returns(uint256) {

  }

  function addPricePoint() external override {

  }

}