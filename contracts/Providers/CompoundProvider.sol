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
    router = _router;
  }

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

  // Tokens nog ergens vandaan pullen
  function withdraw(address _seller, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(_seller); 

    uint256 balanceBeforeRedeem = uToken.balanceOf(address(this)); 
    // Compound redeem: 0 on success, otherwise an Error code
    require(cToken.redeem(_amount) == 0, "something went wrong"); 
    
    uint256 balanceAfterRedeem = uToken.balanceOf(address(this)); 
    uint256 uTokensReceived = balanceAfterRedeem - balanceBeforeRedeem;

    uToken.safeTransfer(_seller, uTokensReceived);

    uint256 balanceAfter = uToken.balanceOf(_seller); 
    require((balanceAfter - balanceBefore - uTokensReceived) == 0, "Error");

    return uTokensReceived;
  }

  function balance(address _address) public view override returns (uint256) {
    uint256 _balanceShares = cToken.balanceOf(_address);
    return _balanceShares;
  }

  // ExchangeRateStored || ExchangerateCurrent? Current is write
  // returned price from compound is scaled by 1e18
  function exchangeRate() external view override returns(uint256) {
    uint256 _price = cToken.exchangeRateStored();
    return _price;
  }

  function getHistoricalPrice(uint256 _period) external override view returns(uint256) {

  }

  function addPricePoint() external override {

  }

  // function _msgSender() internal view virtual returns (address payable) {
  //   return payable(msg.sender); 
  // }
}