// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/ICToken.sol";
import "../Interfaces/IProvider.sol";

import "hardhat/console.sol";

contract CompoundProvider is IProvider{
  using SafeERC20 for IERC20;

  ICToken public cToken; // yusdc
  address override public protocolToken;

  IERC20 public uToken; // usdc
  
  address public router; 
  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyRouter {
    require(msg.sender == router, "ETFProvider: only router");
    _;
  }

  constructor(address _cToken, address _uToken, address _router) {
    cToken = ICToken(_cToken);
    uToken = IERC20(_uToken);
    protocolToken = _cToken;
    router = _router;
  }

  /// @notice Deposit the underlying asset in Compound
  /// @dev Pulls underlying asset from ETFVault, deposit them in Compound, send cTokens back.
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to deposit
  /// @return Tokens received and sent to vault
  function deposit(address _vault, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(address(this));

    uToken.safeTransferFrom(_vault, address(this), _amount);
    uToken.safeIncreaseAllowance(address(cToken), _amount);

    uint256 balanceAfter = uToken.balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error");

    uint256 cTokenBefore = cToken.balanceOf(address(this));
    require(cToken.mint(_amount) == 0, "Error minting Compound");
    uint256 cTokenAfter = cToken.balanceOf(address(this));

    uint cTokensReceived = cTokenAfter - cTokenBefore;
    cToken.transfer(_vault, cTokensReceived);

    return cTokensReceived;
  }

  /// @notice Withdraw the underlying asset from Compound
  /// @dev Pulls cTokens from ETFVault, redeem them from Compound, send underlying back.
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to withdraw
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(address _vault, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(_vault); 

    uint256 balanceBeforeRedeem = uToken.balanceOf(address(this)); 

    require(cToken.transferFrom(_vault, address(this), _amount) == true, "Error transferFrom");
    // Compound redeem: 0 on success, otherwise an Error code
    require(cToken.redeem(_amount) == 0, "Error: compound redeem"); 
    
    uint256 balanceAfterRedeem = uToken.balanceOf(address(this)); 
    uint256 uTokensReceived = balanceAfterRedeem - balanceBeforeRedeem;

    uToken.safeTransfer(_vault, uTokensReceived);

    uint256 balanceAfter = uToken.balanceOf(_vault); 
    require((balanceAfter - balanceBefore - uTokensReceived) == 0, "Error");

    return uTokensReceived;
  }

  /// @notice Get balance from address in shares i.e LP tokens
  /// @param _address Address to request balance from, most likely an ETFVault
  /// @return number of shares i.e LP tokens
  function balanceUnderlying(address _address) public override view returns (uint256) {
    uint256 balanceShares = balance(_address);
    uint256 price = exchangeRate();
    return balanceShares * price / 1E18;
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev returned price from compound is scaled by 1e18
  /// @param _amount Amount in underyling token e.g USDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount) external view override returns (uint256) {
    uint256 shares = _amount  * 1E18 / exchangeRate();
    return shares;
  }

  /// @notice Get balance of cToken from address
  /// @param _address Address to request balance from
  /// @return number of shares i.e LP tokens
  function balance(address _address) public view override returns (uint256) {
    uint256 _balanceShares = cToken.balanceOf(_address);
    return _balanceShares;
  }

  /// @notice Exchange rate of underyling protocol token
  /// @dev returned price from compound is scaled by 1e18
  /// @return price of LP token
  function exchangeRate() public view override returns(uint256) {
    uint256 _price = cToken.exchangeRateStored();
    return _price;
  }

  function getHistoricalPrice(uint256 _period) external override view returns(uint256) {

  }

  function addPricePoint() external override {

  }

}