// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// SafeErc20 docs geen approve gebruiken https://docs.openzeppelin.com/contracts/3.x/api/token/erc20#SafeERC20
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/Yearn/IYearnProvider.sol";

import "hardhat/console.sol";

// No modifiers yet
contract YearnProvider {
  using SafeERC20 for IERC20;

  IYearn public yToken;  //yusdc
  IERC20 public uToken; // usdc
  mapping(uint256 => uint256) public historicalPrices;

  constructor(address _yToken, address _uToken) {
    yToken = IYearn(_yToken);
    uToken = IERC20(_uToken);
  }

  function setVaultCurrency(address _vaultCurrencyAddress) public {

  }

  function setProtocolToken(address _protocolTokenAddress) public {

  }

  function addPricePoint() external {

  }

  // Beslissen of we voor en na balance checks willen doen
  // fee structure?
  function depositEtf(uint256 _amount) external returns(uint256){
    uToken.safeTransferFrom(_msgSender(), address(this), _amount);

    uToken.safeIncreaseAllowance(address(yToken), _amount);

    yToken.deposit(_amount);

    // send LP tokens to?
  }

  function withdrawEtf(uint256 _amount) external {
    // require(burn of LP tokens?)

    uint256 _price = yToken.pricePerShare();
    uint256 numberOfSharesWithdraw = (_amount / _price) * 1e6;

    uint256 _uAmount = yToken.withdraw(numberOfSharesWithdraw);

    uToken.safeTransfer(_msgSender(), _uAmount);
  }

  function balance() external view returns (uint256) {
    uint256 price = yToken.pricePerShare();
    uint256 balanceShares = yToken.balanceOf(address(this));

    return (balanceShares * price) ;
    }

  function exchangeRate() external view returns(uint256) {

  }

  function getHistoricalPrice(uint256 _period) external view returns(uint256) {

  }

  function _msgSender() internal view virtual returns (address payable) {
    return payable(msg.sender); // added payable
  }
}