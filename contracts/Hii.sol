// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IETFVault.sol";
import "./Interfaces/IRouter.sol";
import "./Interfaces/IGoverned.sol";

import "./VaultToken.sol";

import "hardhat/console.sol";

// ToDo: figure out when to transact from vault to protocols --> on rebalancing OR on vault funds treshhold?
// ToDo: how to do automatic yield farming? --> Swap in uniswap.

contract ETFVault is IETFVault { // is VaultToken
  using SafeERC20 for IERC20;
    // name of the ETF e.g. yield_defi_usd_low (a yield token ETF in DeFi in UDS with low risk) or yield_defi_btc_high or exchange_stocks_usd_mid
  bytes32 public ETFname;

  uint256 public ETFnumber;

  IERC20 public vaultCurrency;
  IRouter public router;
  address public routerAddr;

  address public ETFgame;

    // address of DAO governance contract
  address public governed;

  uint256[] public protocolsInETF;

  modifier onlyETFgame {
    require(msg.sender == ETFgame, "ETFvault: only ETFgame");
    _;
  }

  modifier onlyDao {
    // require(msg.sender == IGoverned(governed).dao(), "ETFvault: only DAO");
    require(msg.sender == governed, "ETFvault: only DAO");
    _;
  }

  // constructor(
  //   bytes32 ETFname_, 
  //   uint256 ETFnumber_, 
  //   address _router,
  //   address _vaultCurrency,
  //   address ETFgame_,
  //   address governed_,
  //   string memory name_,
  //   string memory symbol_
  // ) VaultToken (name_, symbol_) {
  //   ETFname = ETFname_;
  //   ETFnumber = ETFnumber_;
  //   router = IRouter(_router);
  //   vaultCurrency = IERC20(_vaultCurrency);
  //   ETFgame = ETFgame_;
  //   governed = governed_;
  // }

  constructor(address _governed, uint256 _ETFnumber, address _router, address _vaultCurrency) {
    governed = _governed;
    ETFnumber = _ETFnumber;
    router = IRouter(_router);
    routerAddr = _router;
    vaultCurrency = IERC20(_vaultCurrency);
  }

    // period number of the latest rebalance
  uint256 public latestRebalancingPeriod;

    // from the rebalancing period to block number;
  mapping(uint256 => uint256) public rebalancingPeriodToBlock;

    // total number of allocated xaver tokens currently
  uint256 public totalAllocatedTokens;

    // current allocations over the protocols 
  mapping(uint256 => uint256) private currentAllocations;

    // delta of the total number of xaver tokens allocated on next rebalancing
  uint256 private deltaAllocatedTokens;

    // delta of the portfolio on next rebalancing
  mapping(uint256 => uint256) private deltaAllocations;

  function depositETF(address _buyer, uint256 _amount) external {
    vaultCurrency.safeTransferFrom(_buyer, address(this), _amount);
    
    // mint LP tokens and send to user 
  }

  function withdrawETF(address _seller, uint256 _amount) external {

  }

  function rebalanceETF(uint256 _amount) public {
    // TO DO: withdraw from protcols before depositing
    for (uint i = 0; i < protocolsInETF.length; i++) {
      uint256 allocation = currentAllocations[protocolsInETF[i]];
      uint256 amountToDeposit = _amount * allocation / totalAllocatedTokens;

      uint256 currentBalance = balanceUnderlying(protocolsInETF[i]);

      console.log("ProtocolNum: %s, Allocation: %s, amountToDeposit: %s", 
      protocolsInETF[i],
      allocation, 
      amountToDeposit
      );

      // create margin logic instead of 1E6 
      if (amountToDeposit / 1E6 == currentBalance / 1E6) break;

      if (amountToDeposit / 1E6 > currentBalance / 1E6) {
        uint256 amount = amountToDeposit - currentBalance;
        depositInProtocol(amount, protocolsInETF[i]);
        console.log("deposited %s", amount);
      }

      if (amountToDeposit / 1E6 < currentBalance / 1E6)  {
        uint256 amount = currentBalance - amountToDeposit;
        withdrawFromProtocol(amount, protocolsInETF[i]);
        console.log("withdrawed %s", amount);
      }
    }
  }
  

  function depositInProtocol(uint256 _amount, uint256 _protocol) internal {
    address provider = router.protocol(ETFnumber, _protocol);

    vaultCurrency.safeIncreaseAllowance(provider, _amount);
    router.deposit(ETFnumber, _protocol, address(this), _amount);
  }

  function withdrawFromProtocol(uint256 _amount, uint256 _protocol) internal {
    address provider = router.protocol(ETFnumber, _protocol);
    address protocolToken = router.getProtocolTokenAddress(ETFnumber, _protocol);

    IERC20(protocolToken).safeIncreaseAllowance(provider, _amount);
    router.withdraw(ETFnumber, _protocol, address(this), _amount);
  }

  function addProtocol(bytes32 name, address addr) public override onlyDao {

  }

  function balanceUnderlying(uint256 _protocolNumber) public view returns(uint256) {
    uint256 underlyingBalance = router.balanceUnderlying(ETFnumber, _protocolNumber, address(this));
  
    return underlyingBalance;
  }

  function price(uint256 _protocolNumber) public view returns(uint256) {
    uint256 protocolPrice = router.exchangeRate(ETFnumber, _protocolNumber);

    return protocolPrice;
  }

  // onlyETFGame modifier
  function setDeltaAllocations() public {

  }

  // onlyETFGame modifier
  function setAllocations(uint256[][] memory _allocations) public {
    // Reset current allocations to 0
    for (uint i = 0; i < protocolsInETF.length; i++) {
      currentAllocations[protocolsInETF[i]] = 0;
    }

    totalAllocatedTokens = 0;
    delete protocolsInETF;

    // Set new allocations
    for (uint i = 0; i < _allocations.length; i++) {
      currentAllocations[_allocations[i][0]] = _allocations[i][1];
      totalAllocatedTokens += _allocations[i][1];

      protocolsInETF.push(_allocations[i][0]);
    }
    console.log("TotalAllocatedTokens %s", totalAllocatedTokens);
  }

  // For Testing
  function getAllocationTEST(uint256 _protocolNum) public view returns(uint256) {
    return currentAllocations[_protocolNum];
  }

  function getProtocolsInETF() public view returns(uint256[] memory) {
    return protocolsInETF;
  }
}