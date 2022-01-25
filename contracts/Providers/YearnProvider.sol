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
  address override public protocolToken;

  IERC20 public uToken; // usdc
  
  address public router; 
  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyRouter {
    require(msg.sender == router, "ETFProvider: only router");
    _;
  }

  constructor(address _yToken, address _uToken, address _router) {
    yToken = IYearn(_yToken);
    uToken = IERC20(_uToken);
    protocolToken = _yToken;
    router = _router;
  }

  function deposit(address _vault, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(address(this));

    uToken.safeTransferFrom(_vault, address(this), _amount);
    uToken.safeIncreaseAllowance(address(yToken), _amount);

    uint256 balanceAfter = uToken.balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error");
    uint256 yTokenReceived = yToken.deposit(_amount);
    yToken.transfer(_vault, yTokenReceived);

    return yTokenReceived;
  }

  function withdraw(address _vault, uint256 _amount) external override onlyRouter returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(_vault); 

    require(yToken.transferFrom(_vault, address(this), _amount) == true, "Error transferFrom");

    uint256 uAmountReceived = yToken.withdraw(_amount); 
    uToken.safeTransfer(_vault, uAmountReceived);

    uint256 balanceAfter = uToken.balanceOf(_vault); 
    require((balanceAfter - balanceBefore - uAmountReceived) == 0, "Error");

    return uAmountReceived;
  }

  function balanceUnderlying(address _address) public override view returns (uint256) {
    uint256 balanceShares = balance(_address);
    uint256 price = exchangeRate();
    return balanceShares * price / 1E6;
  }

  function calcShares(uint256 _amount) external view override returns (uint256) {
    uint256 shares = _amount  * 1E6 / exchangeRate();

    return shares;
  }

  function balance(address _address) public view override returns (uint256) {
    uint256 _balanceShares = yToken.balanceOf(_address);

    return _balanceShares;
  }

  function exchangeRate() public override view returns(uint256) {
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