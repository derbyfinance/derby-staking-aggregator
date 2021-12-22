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
  
  address public router; 
  uint256 public constant SCALE = 1e6; // checken
  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyRouter {
    require(msg.sender == router, "ETFvault: only Router");
    _;
  }

  constructor(address _yToken, address _uToken, address _router) {
    yToken = IYearn(_yToken);
    uToken = IERC20(_uToken);
    router = _router;
  }

  function addPricePoint() external {

  }

  // Beslissen of we voor en na balance checks willen doen
  // waar token minten
  // fee structure?
  function depositEtf(address _buyer, uint256 _amount) external onlyRouter returns(uint256) {
     // require(balance before and after?)
    uToken.safeTransferFrom(_buyer, address(this), _amount);
    uToken.safeIncreaseAllowance(address(yToken), _amount);

    uint256 _yTokenReceived = yToken.deposit(_amount);
    // send LP tokens to?

    return _yTokenReceived;
  }

  function withdrawEtf(address _seller, uint256 _amount) external onlyRouter returns(uint256) {
    // require(burn of LP tokens?)
    // require(balance before and after?)
    // in welke currency withdrawen?

    uint256 _price = yToken.pricePerShare();
    uint256 numberOfSharesWithdraw = (_amount / _price) * 1e6;

    uint256 _uAmountReceived = yToken.withdraw(numberOfSharesWithdraw);

    uToken.safeTransfer(_seller, _uAmountReceived);

    return _uAmountReceived;
  }

  function balance() public view returns (uint256) {
    uint256 price = yToken.pricePerShare();
    uint256 balanceShares = yToken.balanceOf(address(this));

    console.log("price per share %s", price);
    console.log("balanceShares %s", balanceShares);

    return (balanceShares * price) / SCALE ;
    }

  function exchangeRate() external view returns(uint256) {
    // yearn price?
  }

  function getHistoricalPrice(uint256 _period) external view returns(uint256) {

  }

  function _msgSender() internal view virtual returns (address payable) {
    return payable(msg.sender); 
}