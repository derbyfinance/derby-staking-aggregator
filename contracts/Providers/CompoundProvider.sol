// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/ICToken.sol";
import "../Interfaces/ExternalInterfaces/IComptroller.sol";
import "../Interfaces/IProvider.sol";

import "hardhat/console.sol";

contract CompoundProvider is IProvider {
  using SafeERC20 for IERC20;

  IComptroller public comptroller;
  address public controller; 
  
  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyController {
    require(msg.sender == controller, "ETFProvider: only controller");
    _;
  }

  constructor(address _controller, address _comptroller) {
    comptroller = IComptroller(_comptroller);
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
    uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    IERC20(_uToken).safeTransferFrom(_vault, address(this), _amount);
    IERC20(_uToken).safeIncreaseAllowance(_cToken, _amount);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    uint256 cTokenBefore = ICToken(_cToken).balanceOf(address(this));
    require(ICToken(_cToken).mint(_amount) == 0, "Error minting Compound");
    uint256 cTokenAfter = ICToken(_cToken).balanceOf(address(this));

    uint cTokensReceived = cTokenAfter - cTokenBefore;
    ICToken(_cToken).transfer(_vault, cTokensReceived);

    return cTokensReceived;
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
    uint256 balanceBefore = IERC20(_uToken).balanceOf(_vault); 

    uint256 balanceBeforeRedeem = IERC20(_uToken).balanceOf(address(this)); 

    require(ICToken(_cToken).transferFrom(_vault, address(this), _amount) == true, "Error: transferFrom");
    // Compound redeem: 0 on success, otherwise an Error code
    require(ICToken(_cToken).redeem(_amount) == 0, "Error: compound redeem"); 
    
    uint256 balanceAfterRedeem = IERC20(_uToken).balanceOf(address(this)); 
    uint256 uTokensReceived = balanceAfterRedeem - balanceBeforeRedeem;

    IERC20(_uToken).safeTransfer(_vault, uTokensReceived);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(_vault); 
    require((balanceAfter - balanceBefore - uTokensReceived) == 0, "Error Withdraw: under/overflow");

    return uTokensReceived;
  }

  /// @notice Get balance from address in underlying token
  /// @param _address Address to request balance from, most likely an ETFVault
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return balance in underlying token
  function balanceUnderlying(address _address, address _cToken) public view override returns(uint256) {
    uint256 balanceShares = balance(_address, _cToken);
    uint256 price = exchangeRate(_cToken);
    return balanceShares * price / 1E18;
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev returned price from compound is scaled by 1e18
  /// @param _amount Amount in underyling token e.g USDC
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount, address _cToken) external view override returns(uint256) {
    uint256 shares = _amount  * 1E18 / exchangeRate(_cToken);
    return shares;
  }

  /// @notice Get balance of cToken from address
  /// @param _address Address to request balance from
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function balance(address _address, address _cToken) public view override returns(uint256) {
    uint256 _balanceShares = ICToken(_cToken).balanceOf(_address);
    return _balanceShares;
  }

  /// @notice Exchange rate of underyling protocol token
  /// @dev returned price from compound is scaled by 1e18
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return price of LP token
  function exchangeRate(address _cToken) public view override returns(uint256) {
    uint256 _price = ICToken(_cToken).exchangeRateStored();
    return _price;
  }

  /// @notice Claims/harvest COMP tokens from the Comptroller
  /// @param _cToken Address of protocol LP Token eg cUSDC
  function claim(address _cToken, address _claimer) external override returns(bool) {
    address[] memory cTokens = new address[](1);
    cTokens[0] = _cToken;
    comptroller.claimComp(_claimer, cTokens);

    return true;
  }

  function getHistoricalPrice(uint256 _period) external view returns(uint256) {

  }

  function addPricePoint() external override {

  }

}