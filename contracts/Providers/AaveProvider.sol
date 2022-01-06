// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/IAToken.sol";
import "../Interfaces/ExternalInterfaces/IALendingPool.sol";
import "../Interfaces/IProvider.sol";

import "hardhat/console.sol";

contract AaveProvider is IProvider{
  using SafeERC20 for IERC20;

  IAToken public aToken; 
  IERC20 public uToken; 

  uint16 private aaveReferral;
  address public router; 
  address public uTokenAddr;

  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyRouter {
    require(msg.sender == router, "ETFProvider: only router");
    _;
  }

  constructor(address _aToken, address _router) {
    aToken = IAToken(_aToken);

    uTokenAddr = aToken.UNDERLYING_ASSET_ADDRESS();
    uToken = IERC20(uTokenAddr);
    
    router = _router;
    aaveReferral = 0;
  }

  // OnlyDao modifier? referral code for aave. Will not be used in the near future but nice to have.
  function setAaveReferral(uint16 _code) external {
    aaveReferral = _code;
  }

  function deposit(address _buyer, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(address(this));

    uToken.safeTransferFrom(_buyer, address(this), _amount);
    uToken.safeIncreaseAllowance(address(aToken.POOL()), _amount);

    uint256 balanceAfter = uToken.balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error");

    IALendingPool(aToken.POOL()).deposit(uTokenAddr, _amount, _buyer, aaveReferral);

    return _amount;
  }

  function withdraw(address _seller, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(_seller); 

    require(aToken.transferFrom(_seller, address(this), _amount) == true, "Error");
    uint256 uTokensReceived = IALendingPool(aToken.POOL()).withdraw(uTokenAddr, _amount, _seller);

    uint256 balanceAfter = uToken.balanceOf(_seller); 

    require((balanceAfter - balanceBefore - uTokensReceived) == 0, "Error");

    return uTokensReceived;
  }

  function balance(address _address) public view returns (uint256) {
    uint256 _balanceShares = aToken.balanceOf(_address);
    return _balanceShares;
  }

  function exchangeRate() external view override returns(uint256) {

  }

  function getHistoricalPrice(uint256 _period) external override view returns(uint256) {

  }

  function addPricePoint() external override {

  }

}