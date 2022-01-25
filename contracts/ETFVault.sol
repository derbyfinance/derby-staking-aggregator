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

  int256 public marginScale = 1E7;
  uint256 public uScale = 1E6;

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
  int256 public totalAllocatedTokens;

    // current allocations over the protocols 
  mapping(uint256 => int256) private currentAllocations;

    // delta of the total number of xaver tokens allocated on next rebalancing
  int256 private deltaAllocatedTokens;

    // delta of the portfolio on next rebalancing
  mapping(uint256 => int256) private deltaAllocations;

  mapping(uint256 => uint256) private protocolToDeposit;
  mapping(uint256 => uint256) private protocolToWithdraw;


  function depositETF(address _buyer, uint256 _amount) external {
    vaultCurrency.safeTransferFrom(_buyer, address(this), _amount);
    
    // mint LP tokens and send to user 
  }

  function withdrawETF(address _seller, uint256 _amount) external {

  }

  function rebalanceETF(int256 _amount) public {
    uint256 latestProtocolId = router.latestProtocolId();
    int256 totalUnderlying = int(getTotalUnderlying(latestProtocolId));

    totalAllocatedTokens += deltaAllocatedTokens;
    deltaAllocatedTokens = 0;
    console.log("latestProtocolId %s", latestProtocolId);
    
    for (uint i = 0; i <= latestProtocolId; i++) {
      // CHECK: CurrentAllocations can go below 0
      if (deltaAllocations[i] == 0) continue;
      currentAllocations[i] += deltaAllocations[i];
      deltaAllocations[i] = 0;

      int256 amountToDeposit = (totalUnderlying + _amount) * currentAllocations[i] / totalAllocatedTokens;
      int256 currentBalance = int256(balanceUnderlying(i));

      // create margin logic instead of 1E6 
      if (amountToDeposit / marginScale == currentBalance / marginScale) continue;

      // Deposit
      if (amountToDeposit / marginScale > currentBalance / marginScale) {
        int256 amount = amountToDeposit - currentBalance;
  	    console.log("deposit: %s, from Protocol: %s", uint(amount), i);
        protocolToDeposit[i] = uint256(amount);
      }

      //  Execute withdraw
      if (amountToDeposit / marginScale < currentBalance / marginScale)  {
        int256 amount = currentBalance - amountToDeposit;
        console.log("withdraw: %s, from Protocol: %s", uint(amount), i);
        withdrawFromProtocol(uint256(amount), i);
        protocolToWithdraw[i] = 0;
      }
    }

    executeDeposits(latestProtocolId);
  }

  function executeDeposits(uint256 _latestProtocolId) internal  {
    for (uint i = 0; i <= _latestProtocolId; i++) {
      uint256 amount = protocolToDeposit[i];
      if (amount == 0) continue;

      depositInProtocol(amount, i);
      protocolToDeposit[i] = 0;
      // console.log("deposited: %s, to Protocol: %s", amount, i);
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
    uint256 shares = router.calcShares(ETFnumber, _protocol, _amount);

    IERC20(protocolToken).safeIncreaseAllowance(provider, shares);
    router.withdraw(ETFnumber, _protocol, address(this), shares);
  }

  function getTotalUnderlying(uint256 _latestProtocolId) public view returns(uint256) {
    uint256 balance;
    for (uint i = 0; i <= _latestProtocolId; i++) {
      if (currentAllocations[i] == 0) continue;
      uint256 balanceProtocol = balanceUnderlying(i);
      balance += balanceProtocol;
    }

    return balance;
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
  function setDeltaAllocations(uint256 _protocolNum, int256 _allocation) public {
    int256 deltaAllocation = deltaAllocations[_protocolNum] + _allocation;
    deltaAllocations[_protocolNum] = deltaAllocation;
    
    deltaAllocatedTokens += _allocation; 
  }

  // For Testing
  function getAllocationTEST(uint256 _protocolNum) public view returns(int256) {
    return currentAllocations[_protocolNum];
  }

  function getDeltaAllocationTEST(uint256 _protocolNum) public view returns(int256) {
    return deltaAllocations[_protocolNum];
  }

  function getProtocolsInETF() public view returns(uint256[] memory) {

  }
}


  // function rebalanceETF(uint256 _amount) public {
  //   // TO DO: withdraw from protcols before depositing
  //   for (uint i = 0; i < protocolsInETF.length; i++) {
  //     uint256 allocation = currentAllocations[protocolsInETF[i]];
  //     uint256 amountToDeposit = _amount * allocation / totalAllocatedTokens;

  //     uint256 currentBalance = balanceUnderlying(protocolsInETF[i]);

  //     // For testing
  //     console.log("ProtocolNum: %s, Allocation: %s, amountToDeposit: %s", 
  //     protocolsInETF[i],
  //     allocation, 
  //     amountToDeposit
  //     );

  //     // create margin logic instead of 1E6 
  //     if (amountToDeposit / 1E6 == currentBalance / 1E6) break;

  //     if (amountToDeposit / 1E6 > currentBalance / 1E6) {
  //       uint256 amount = amountToDeposit - currentBalance;
  //       depositInProtocol(amount, protocolsInETF[i]);
  //       console.log("deposited %s", amount);
  //     }

  //     if (amountToDeposit / 1E6 < currentBalance / 1E6)  {
  //       uint256 amount = currentBalance - amountToDeposit;
  //       withdrawFromProtocol(amount, protocolsInETF[i]);
  //       console.log("withdrawed %s", amount);
  //     }
  //   }
  // }