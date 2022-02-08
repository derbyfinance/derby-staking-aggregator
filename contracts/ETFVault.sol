// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

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

  int256 public marginScale = 1E9; // 100 USDC
  uint256 public uScale = 1E6;
  uint256 public threshold;

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

  constructor(
    address _governed, 
    uint256 _ETFnumber, 
    address _router, 
    address _vaultCurrency, 
    uint256 _threshold
    ) {
    vaultCurrency = IERC20(_vaultCurrency);
    router = IRouter(_router);

    governed = _governed;
    ETFnumber = _ETFnumber;
    routerAddr = _router;
    threshold = _threshold;
  }

    // period number of the latest rebalance
  uint256 public latestRebalancingPeriod;

    // from the rebalancing period to block number;
  mapping(uint256 => uint256) public rebalancingPeriodToBlock;

    // total number of allocated xaver tokens currently
  int256 public totalAllocatedTokens;

    // current allocations over the protocols 
  mapping(uint256 => int256) internal currentAllocations;

    // delta of the total number of xaver tokens allocated on next rebalancing
  int256 private deltaAllocatedTokens;

    // delta of the portfolio on next rebalancing
  mapping(uint256 => int256) internal deltaAllocations;

  mapping(uint256 => uint256) private protocolToDeposit;


  function depositETF(address _buyer, uint256 _amount) external {
    vaultCurrency.safeTransferFrom(_buyer, address(this), _amount);
    
    // mint LP tokens and send to user 
  }

  function withdrawETF(address _seller, uint256 _amount) external {

  }

  function rebalanceETF() public {
    uint256 amount = vaultCurrency.balanceOf(address(this));

    uint256 latestProtocolId = router.latestProtocolId();
    uint256 totalUnderlying = getTotalUnderlying();

    totalAllocatedTokens += deltaAllocatedTokens;
    deltaAllocatedTokens = 0;
    
    for (uint i = 0; i <= latestProtocolId; i++) {
      if (deltaAllocations[i] == 0) continue;

      currentAllocations[i] += deltaAllocations[i];
      deltaAllocations[i] = 0;
      require(currentAllocations[i] >= 0, "Current Allocation underflow");

      int256 amountToProtocol = (int(totalUnderlying) + int(amount)) * currentAllocations[i] / totalAllocatedTokens;
      uint256 currentBalance = balanceUnderlying(i);

      int256 amountToDeposit = amountToProtocol - int(currentBalance);
      uint256 amountToWithdraw = amountToDeposit < 0 ? currentBalance - uint(amountToProtocol) : 0;

      if (amountToDeposit > marginScale) {
        protocolToDeposit[i] = uint256(amountToDeposit);
      } 

      if (amountToWithdraw > uint(marginScale)) {
        withdrawFromProtocol(amountToWithdraw, i);
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
    }
  }

  function depositInProtocol(uint256 _amount, uint256 _protocol) internal {
    address provider = router.protocol(ETFnumber, _protocol);

    vaultCurrency.safeIncreaseAllowance(provider, _amount);
    router.deposit(ETFnumber, _protocol, address(this), _amount);
    console.log("deposited: %s, to Protocol: %s", uint(_amount), _protocol);
  }

  function withdrawFromProtocol(uint256 _amount, uint256 _protocol) internal {
    address provider = router.protocol(ETFnumber, _protocol);
    address protocolToken = router.getProtocolTokenAddress(ETFnumber, _protocol);
    uint256 shares = router.calcShares(ETFnumber, _protocol, _amount);

    IERC20(protocolToken).safeIncreaseAllowance(provider, shares);
    router.withdraw(ETFnumber, _protocol, address(this), shares);
    console.log("withdrawed: %s, to Protocol: %s", uint(_amount), _protocol);
  }

  function getTotalUnderlying() public view returns(uint256) {
    uint256 latestProtocolId = router.latestProtocolId();
    uint256 balance;
    for (uint i = 0; i <= latestProtocolId; i++) {
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

  function setThreshold(uint256 _amount) external onlyDao {
    threshold = _amount;
  }
}
