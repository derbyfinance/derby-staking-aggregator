// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/Yearn/IYearnProvider.sol";
import "../IProvider.sol";

import "hardhat/console.sol";

contract YearnProvider {
  using SafeERC20 for IERC20;
  using SafeERC20 for IYearn;

  IYearn public yToken; // yusdc
  IERC20 public uToken; // usdc
  
  address public vault; 
  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyVault {
    require(msg.sender == vault, "ETFvault: only Vault");
    _;
  }

  constructor(address _yToken, address _uToken, address _vault) {
    yToken = IYearn(_yToken);
    uToken = IERC20(_uToken);
    vault = _vault;
  }

  function addPricePoint() external {

  }

  function deposit(address _buyer, uint256 _amount) external onlyVault returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(address(this));

    uToken.safeTransferFrom(_buyer, address(this), _amount);
    uToken.safeIncreaseAllowance(address(yToken), _amount);

    uint256 balanceAfter = uToken.balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error");

    uint256 yTokenReceived = yToken.deposit(_amount);

    // yToken.transfer(vault, yTokenReceived);

    return yTokenReceived;
  }

  // Tokens nog ergens vandaan pullen
  function withdraw(address _seller, uint256 _amount) external onlyVault returns(uint256) {
    uint256 balanceBefore = uToken.balanceOf(_seller); 

    uint256 uAmountReceived = yToken.withdraw(_amount); 
    uToken.safeTransfer(_seller, uAmountReceived);

    uint256 balanceAfter = uToken.balanceOf(_seller); 
    require((balanceAfter - balanceBefore - uAmountReceived) == 0, "Error");

    return uAmountReceived;
  }

  function balance() public view returns (uint256) {
    uint256 _balanceShares = yToken.balanceOf(address(this));

    console.log("balanceShares %s", _balanceShares);

    return _balanceShares;
    }

  function exchangeRate() external view returns(uint256) {
    uint256 _price = yToken.pricePerShare();

    return _price;
  }

  function getHistoricalPrice(uint256 _period) external view returns(uint256) {

  }

  function _msgSender() internal view virtual returns (address payable) {
    return payable(msg.sender); 
  }
}