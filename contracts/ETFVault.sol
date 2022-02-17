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

contract ETFVault is IETFVault, VaultToken {
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

  int256 public marginScale = 1E10; // 1000 USDC
  uint256 public uScale = 1E6;
  uint256 public threshold;
  uint256 public liquidityPerc = 10;

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
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    address _governed, 
    uint256 _ETFnumber, 
    address _router, 
    address _vaultCurrency, 
    uint256 _threshold
    ) VaultToken (_name, _symbol, _decimals) {
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

  // protocols to deposit in after withdrawals are executed
  mapping(uint256 => uint256) private protocolToDeposit;

  /// @notice Deposit in ETFVault
  /// @dev Deposit VaultCurrency to ETFVault and mint LP tokens
  /// @param _buyer Address from buyer of the tokens
  /// @param _amount Amount to deposit
  /// @return Tokens received by buyer
  function depositETF(address _buyer, uint256 _amount) external returns(uint256) {
    vaultCurrency.safeTransferFrom(_buyer, address(this), _amount);

    uint256 balanceSelf = vaultCurrency.balanceOf(address(this));
    uint256 totalSupply = totalSupply();
    uint256 shares = 0;

    if (totalSupply > 0) {
      shares = ( _amount * totalSupply ) / (getTotalUnderlying() + balanceSelf - _amount);
    } else {
      shares = _amount; 
    }
    
    _mint(_buyer, shares);

    return shares;
  }

  /// @notice Withdraw from ETFVault
  /// @dev Withdraw VaultCurrency from ETFVault and burn LP tokens
  /// @param _seller Address from seller of the tokens
  /// @param _amount Amount to withdraw
  /// @return Amount received by seller
  function withdrawETF(address _seller, uint256 _amount) external returns(uint256) {
    uint256 value = _amount * exchangeRate() / uScale;
    require(value > 0, "no value");

    if (value > vaultCurrency.balanceOf(address(this))) pullFunds(value);
      
    _burn(_seller, _amount);
    vaultCurrency.safeTransfer(_seller, value);

    return value;
  }

  function pullFunds(uint256 _value) internal {
    uint256 latestProtocolId = router.latestProtocolId();
    uint256 shortage = _value - vaultCurrency.balanceOf(address(this));

    for (uint i = 0; i <= latestProtocolId; i++) {
      if (currentAllocations[i] == 0) continue;

      uint256 balanceProtocol = balanceUnderlying(i);
      uint256 amountToWithdraw = shortage > balanceProtocol ? balanceProtocol : shortage;

      withdrawFromProtocol(i, amountToWithdraw);

      if (_value < vaultCurrency.balanceOf(address(this))) break;
    }
  }

  // TotalUnderlying = Underlying balance protocols + balance vault
  function exchangeRate() public view returns(uint256) {
    if (totalSupply() == 0) return 1;
    
    uint256 balanceSelf = vaultCurrency.balanceOf(address(this));
    // console.log("total supply %s", totalSupply());
    // console.log("getTotalUnderlying %s", getTotalUnderlying());
    return (getTotalUnderlying() + balanceSelf)  * uScale / totalSupply();
  }

  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev Loops over all protocols in ETF, calculate new currentAllocation based on deltaAllocation
  /// @dev amountToProtocol = totalAmount * currentAllocation / totalAllocatedTokens
  /// @dev amountToDeposit = amountToProtocol - currentBalanceProtocol
  /// @dev if amountToDeposit < 0 => withdraw
  /// @dev Execute all withdrawals before deposits
  function rebalanceETF() public {
    uint256 balanceVault = vaultCurrency.balanceOf(address(this));
    uint256 amount = balanceVault - (balanceVault * liquidityPerc / 100);
    console.log("amount %s", amount);
    // uint256 amount = vaultCurrency.balanceOf(address(this));

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
      console.log("amount to deposit %s", uint(amountToDeposit));
      uint256 amountToWithdraw = amountToDeposit < 0 ? currentBalance - uint(amountToProtocol) : 0;

      if (amountToDeposit > marginScale) {
        protocolToDeposit[i] = uint256(amountToDeposit);
      } 

      if (amountToWithdraw > uint(marginScale)) {
        withdrawFromProtocol(i, amountToWithdraw);
      }
    }

    executeDeposits(latestProtocolId);
  }

  /// @notice Helper function so the rebalance will execute all withdrawals first
  /// @dev Executes and resets all deposits set in mapping(protocolToDeposit) by rebalanceETF
  /// @param _latestProtocolId Latest protocolNumber to stop the loop
  function executeDeposits(uint256 _latestProtocolId) internal  {
    for (uint i = 0; i <= _latestProtocolId; i++) {
      uint256 amount = protocolToDeposit[i];
      if (amount == 0) continue;

      depositInProtocol(i, amount);
      protocolToDeposit[i] = 0;
    }
  }

  /// @notice Deposit amount to underlying protocol
  /// @dev Deposits VaultCurrency in Protocol e.g USDC
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to deposit
  function depositInProtocol(uint256 _protocolNum, uint256 _amount) internal {
    address provider = router.protocol(ETFnumber, _protocolNum);

    vaultCurrency.safeIncreaseAllowance(provider, _amount);
    router.deposit(ETFnumber, _protocolNum, address(this), _amount);
    console.log("deposited: %s, to Protocol: %s", uint(_amount), _protocolNum);
  }

  /// @notice Withdraw amount from underlying protocol
  /// @dev shares = amount / PricePerShare
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to withdraw
  function withdrawFromProtocol(uint256 _protocolNum, uint256 _amount) internal {
    address provider = router.protocol(ETFnumber, _protocolNum);
    address protocolToken = router.getProtocolTokenAddress(ETFnumber, _protocolNum);
    uint256 shares = router.calcShares(ETFnumber, _protocolNum, _amount);

    IERC20(protocolToken).safeIncreaseAllowance(provider, shares);
    router.withdraw(ETFnumber, _protocolNum, address(this), shares);
    console.log("withdrawed: %s, to Protocol: %s", uint(_amount), _protocolNum);
  }

  /// @notice Get total balance in VaultCurrency in all underlying protocols
  /// @return Total balance in VaultCurrency e.g USDC
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

  /// @notice Get balance in VaultCurrency in underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return Balance in VaultCurrency e.g USDC
  function balanceUnderlying(uint256 _protocolNum) public view returns(uint256) {
    uint256 underlyingBalance = router.balanceUnderlying(ETFnumber, _protocolNum, address(this));
    return underlyingBalance;
  }

  /// @notice Get price for underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return Price per share
  function price(uint256 _protocolNum) public view returns(uint256) {
    uint256 protocolPrice = router.exchangeRate(ETFnumber, _protocolNum);

    return protocolPrice;
  }

  // onlyETFGame modifier
  /// @notice Set the delta allocated tokens by game contract
  /// @dev Allocation can be negative
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  /// @param _allocation Delta allocation in tokens
  function setDeltaAllocations(uint256 _protocolNum, int256 _allocation) public {
    int256 deltaAllocation = deltaAllocations[_protocolNum] + _allocation;
    deltaAllocations[_protocolNum] = deltaAllocation;
    deltaAllocatedTokens += _allocation; 
  }

  /// @notice Set threshold by DAO i.e above which amount the rebalance will trigger
  function setThreshold(uint256 _amount) external onlyDao {
    threshold = _amount;
  }
}
