// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/IYearn.sol";
import "../Interfaces/IProvider.sol";

import "hardhat/console.sol";

contract YearnProvider is IProvider{
  using SafeERC20 for IERC20;

  IYearn public yToken; // yusdc
  IERC20 public uToken; // usdc
  
  address public router; 
  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyRouter {
    require(msg.sender == router, "ETFrouter: only router");
    _;
  }

  constructor(address _yToken, address _uToken, address _router) {
    yToken = IYearn(_yToken);
    uToken = IERC20(_uToken);
    router = _router;
  }

  function deposit(address _buyer, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(address(this));

    uToken.safeTransferFrom(_buyer, address(this), _amount);
    uToken.safeIncreaseAllowance(address(yToken), _amount);

    uint256 balanceAfter = uToken.balanceOf(address(this));
    console.log("Balance after from contract %s", balanceAfter);
    require((balanceAfter - balanceBefore - _amount) == 0, "Error");

    uint256 yTokenReceived = yToken.deposit(_amount);

    // yToken.transfer(router, yTokenReceived);

    return yTokenReceived;
  }

  // Tokens nog ergens vandaan pullen
  function withdraw(address _seller, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(_seller); 

    uint256 uAmountReceived = yToken.withdraw(_amount); 
    uToken.safeTransfer(_seller, uAmountReceived);

    uint256 balanceAfter = uToken.balanceOf(_seller); 
    require((balanceAfter - balanceBefore - uAmountReceived) == 0, "Error");

    return uAmountReceived;
  }

  function balance() public view returns (uint256) {
    uint256 _balanceShares = yToken.balanceOf(address(this));

    return _balanceShares;
  }

  function exchangeRate() external override view returns(uint256) {
    uint256 _price = yToken.pricePerShare();

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