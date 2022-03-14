// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IETFVault.sol";
import "./Interfaces/IRouter.sol";
import "./Interfaces/IGoverned.sol";
import "./Interfaces/ExternalInterfaces/ISwapRouter.sol";
import "./Interfaces/ExternalInterfaces/IUniswapV3Factory.sol";
import "./Interfaces/ExternalInterfaces/IUniswapV3Pool.sol";

import "./VaultToken.sol";

import "hardhat/console.sol";

// ToDo: figure out when to transact from vault to protocols --> on rebalancing OR on vault funds treshhold?
// ToDo: how to do automatic yield farming? --> Swap in uniswap.

contract ETFVault is VaultToken {
  using SafeERC20 for IERC20;
  // name of the ETF e.g. yield_defi_usd_low (a yield token ETF in DeFi in UDS with low risk) or yield_defi_btc_high or exchange_stocks_usd_mid
  bytes32 public ETFname;

  IERC20 public vaultCurrency;
  IRouter public router;

  address public WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  address public uniswapRouter = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
  address public uniswapFactory = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
  address public vaultCurrencyAddr; 
  address public routerAddr;

  address public ETFgame;

  // address of DAO governance contract
  address public governed;

  int256 public marginScale = 1E10; // 1000 USDC
  uint256 public uScale;
  uint256 public liquidityPerc = 10;

  uint24 public poolFee = 3000;

  modifier onlyETFgame {
    require(msg.sender == ETFgame, "ETFvault: only ETFgame");
    _;
  }

  modifier onlyDao {
    // require(msg.sender == IGoverned(governed).dao(), "ETFvault: only DAO");
    require(msg.sender == governed, "ETFvault: only DAO");
    _;
  }

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    address _governed,
    address _ETFGame, 
    address _router, 
    address _vaultCurrency,
    uint256 _uScale
    ) VaultToken (_name, _symbol, _decimals) {
    vaultCurrency = IERC20(_vaultCurrency);
    vaultCurrencyAddr = _vaultCurrency;

    router = IRouter(_router);
    routerAddr = _router;

    governed = _governed;
    ETFgame = _ETFGame;
    routerAddr = _router;
    uScale = _uScale;
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

  mapping(uint256 => uint256) private lastPrice;

  /// @notice Deposit in ETFVault
  /// @dev Deposit VaultCurrency to ETFVault and mint LP tokens
  /// @param _buyer Address from buyer of the tokens
  /// @param _amount Amount to deposit
  /// @return Tokens received by buyer
  function depositETF(address _buyer, uint256 _amount) external returns(uint256) {
    uint256 balanceBefore = vaultCurrency.balanceOf(address(this));
    vaultCurrency.safeTransferFrom(_buyer, address(this), _amount);
    uint256 balanceAfter = vaultCurrency.balanceOf(address(this));

    uint256 amount = balanceAfter - balanceBefore;
    uint256 totalSupply = totalSupply();
    uint256 shares = 0;

    if (totalSupply > 0) {
      shares = ( amount * totalSupply ) / (getTotalUnderlying() + balanceBefore);
    } else {
      shares = amount; 
    }
    
    _mint(_buyer, shares);

    return shares;
  }

  /// @notice Withdraw from ETFVault
  /// @dev Withdraw VaultCurrency from ETFVault and burn LP tokens
  /// @param _seller Address from seller of the tokens
  /// @param _amount Amount to withdraw in LP tokens
  /// @return Amount received by seller in vaultCurrency
  function withdrawETF(address _seller, uint256 _amount) external returns(uint256) {
    uint256 value = _amount * exchangeRate() / uScale;
    require(value > 0, "no value");

    if (value > vaultCurrency.balanceOf(address(this))) pullFunds(value);
      
    _burn(_seller, _amount);
    vaultCurrency.safeTransfer(_seller, value);

    return value;
  }

  /// @notice Withdraw from protocols on shortage in Vault
  /// @dev Keeps on withdrawing until the Vault balance > _value
  /// @param _value The total value of vaultCurrency an user is trying to withdraw. 
  /// @param _value The (value - current underlying value of this vault) is withdrawn from the underlying protocols.
  function pullFunds(uint256 _value) internal {
    for (uint i = 0; i <= router.latestProtocolId(); i++) {
      if (currentAllocations[i] == 0) continue;

      uint256 shortage = _value - vaultCurrency.balanceOf(address(this));
      uint256 balanceProtocol = balanceUnderlying(i);

      uint256 amountToWithdraw = shortage > balanceProtocol ? balanceProtocol : shortage;

      withdrawFromProtocol(i, amountToWithdraw);
      
      if (_value <= vaultCurrency.balanceOf(address(this))) break;
    }
  }

  /// @notice Exchange rate of Vault LP Tokens in VaultCurrency per LP token (e.g. 1 LP token = $2).
  /// @return Price per share of LP Token
  function exchangeRate() public view returns(uint256) {
    if (totalSupply() == 0) return 1;
    
    uint256 balanceSelf = vaultCurrency.balanceOf(address(this));
    // console.log("total supply %s", totalSupply());
    // console.log("getTotalUnderlying %s", getTotalUnderlying());
    return (getTotalUnderlying() + balanceSelf)  * uScale / totalSupply();
  }

  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev amountToProtocol = totalAmount * currentAllocation / totalAllocatedTokens
  /// @dev amountToDeposit = amountToProtocol - currentBalanceProtocol
  /// @dev if amountToDeposit < 0 => withdraw
  /// @dev Execute all withdrawals before deposits
  function rebalanceETF() public {
    claimTokens(); 
    
    uint256 totalUnderlying = getTotalUnderlying() + vaultCurrency.balanceOf(address(this));
    uint256 liquidityVault = totalUnderlying * liquidityPerc / 100;

    totalAllocatedTokens += deltaAllocatedTokens;
    deltaAllocatedTokens = 0;
    
    rebalanceCheckProtocols(totalUnderlying - liquidityVault);

    executeDeposits();
  }

  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev Loops over all protocols in ETF, calculate new currentAllocation based on deltaAllocation
  /// @param _totalUnderlying Totalunderlying = TotalUnderlyingInProtocols - BalanceVault
  function rebalanceCheckProtocols(uint256 _totalUnderlying) internal {
    for (uint i = 0; i <= router.latestProtocolId(); i++) {
      if (deltaAllocations[i] == 0) continue;
  
      setAllocationAndPrice(i);

      int256 amountToProtocol;
      if (totalAllocatedTokens == 0) amountToProtocol = 0;
      else amountToProtocol = int(_totalUnderlying) * currentAllocations[i] / totalAllocatedTokens;
      
      uint256 currentBalance = balanceUnderlying(i);

      int256 amountToDeposit = amountToProtocol - int(currentBalance);
      uint256 amountToWithdraw = amountToDeposit < 0 ? currentBalance - uint(amountToProtocol) : 0;

      if (amountToDeposit > marginScale) protocolToDeposit[i] = uint256(amountToDeposit); 
      if (amountToWithdraw > uint(marginScale) || currentAllocations[i] == 0) withdrawFromProtocol(i, amountToWithdraw);
    }
  }

  /// @notice Helper function to set allocations and last price from protocols
  /// @param _i Protocol number linked to an underlying protocol e.g compound_usdc_01
  function setAllocationAndPrice(uint256 _i) internal {
    currentAllocations[_i] += deltaAllocations[_i];
    deltaAllocations[_i] = 0;
    require(currentAllocations[_i] >= 0, "Current Allocation underflow");

    lastPrice[_i] = price(_i);
  }

  /// @notice Helper function so the rebalance will execute all withdrawals first
  /// @dev Executes and resets all deposits set in mapping(protocolToDeposit) by rebalanceETF
  function executeDeposits() internal {
    for (uint i = 0; i <= router.latestProtocolId(); i++) {
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
    address provider = router.protocolProvider(_protocolNum);

    if (vaultCurrency.balanceOf(address(this)) < _amount) _amount = vaultCurrency.balanceOf(address(this));

    vaultCurrency.safeIncreaseAllowance(provider, _amount);
    router.deposit(_protocolNum, address(this), _amount);
    console.log("deposited: %s, Protocol: %s", (uint(_amount)/ uScale), _protocolNum);
  }

  /// @notice Withdraw amount from underlying protocol
  /// @dev shares = amount / PricePerShare
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to withdraw
  function withdrawFromProtocol(uint256 _protocolNum, uint256 _amount) internal {
    if (_amount > 0) {
      address provider = router.protocolProvider(_protocolNum);
      address protocolLPToken = router.protocolLPToken(_protocolNum);
      uint256 shares = router.calcShares(_protocolNum, _amount);

      IERC20(protocolLPToken).safeIncreaseAllowance(provider, shares);
      router.withdraw(_protocolNum, address(this), shares);
    }
    console.log("withdrawed: %s, Protocol: %s", (uint(_amount) / uScale), _protocolNum);
  }

  /// @notice Get total balance in VaultCurrency in all underlying protocols
  /// @return Total balance in VaultCurrency e.g USDC
  function getTotalUnderlying() public view returns(uint256) {
    uint256 balance;
    
    for (uint i = 0; i <= router.latestProtocolId(); i++) {
      if (currentAllocations[i] == 0) continue;
      uint256 balanceProtocol = balanceUnderlying(i);
      balance += balanceProtocol;
    }

    return balance;
  }

  /// @notice Get balance in VaultCurrency in underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return Balance in VaultCurrency e.g USDC
  function balanceUnderlying(uint256 _protocolNum) public view returns(uint256) {
    uint256 underlyingBalance = router.balanceUnderlying(_protocolNum, address(this));
    return underlyingBalance;
  }

  /// @notice Get price for underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return Price per share
  function price(uint256 _protocolNum) public view returns(uint256) {
    uint256 protocolPrice = router.exchangeRate(_protocolNum);

    return protocolPrice;
  }

  /// @notice Set the delta allocated tokens by game contract
  /// @dev Allocation can be negative
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  /// @param _allocation Delta allocation in tokens
  function setDeltaAllocations(uint256 _protocolNum, int256 _allocation) public onlyETFgame {
    int256 deltaAllocation = deltaAllocations[_protocolNum] + _allocation;
    deltaAllocations[_protocolNum] = deltaAllocation;
    deltaAllocatedTokens += _allocation; 
  }

  /// @notice Harvest extra tokens from underlying protocols
  /// @dev Loops over protocols in ETF and check if they are claimable in router contract
  function claimTokens() public {
    for (uint i = 0; i <= router.latestProtocolId(); i++) {
      if (currentAllocations[i] == 0) continue;
      bool claim = router.claim(i);

      if (claim) {
        address govToken = router.protocolGovToken(i);
        uint256 tokenBalance = IERC20(govToken).balanceOf(address(this));
        
        swapTokensMulti(tokenBalance, govToken, vaultCurrencyAddr);
      }
    }
  }

  /// @notice Swap tokens on Uniswap
  /// @param _amount Number of tokens to sell
  /// @param _tokenIn Token to sell
  /// @param _tokenOut Token to receive
  /// @return Amountout Number of tokens received
  function swapTokensMulti(uint256 _amount, address _tokenIn, address _tokenOut) internal returns(uint256) {
    IERC20(_tokenIn).safeIncreaseAllowance(uniswapRouter, _amount);

    ISwapRouter.ExactInputParams memory params =
      ISwapRouter.ExactInputParams({
        path: abi.encodePacked(_tokenIn, poolFee, WETH, poolFee, _tokenOut),
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: _amount,
        amountOutMinimum: 0
      });

    uint256 amountOut = ISwapRouter(uniswapRouter).exactInput(params);

    return amountOut;
  }

  // Not functional yet
  function getPoolAmountOut(uint256 _amount, address _tokenIn, address _tokenOut) public view returns(uint256) {
    uint256 amountOut = 0;
    address pool = IUniswapV3Factory(uniswapFactory).getPool(
      _tokenIn,
      _tokenOut,
      poolFee
    );

    address token0 = IUniswapV3Pool(pool).token0();
    address token1 = IUniswapV3Pool(pool).token1();

    (uint256 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();

    if (token0 == _tokenOut) {
      amountOut =  (_amount * 2 ** 192 / sqrtPriceX96 ** 2) * 9970 / 10000;
    }
    if (token1 == _tokenOut) {
      amountOut =  (_amount * sqrtPriceX96 ** 2 / 2 ** 192) * 9970 / 10000;
    }

    // console.log("pool %s", pool);
    // console.log("token0 %s", token0);
    // console.log("token1 %s", token1);
    console.log("sqrtPriceX96 %s", sqrtPriceX96);
    // console.log("amountOut pool %s", amountOut);

    return amountOut;
  }

  /// @notice Set the marginScale, the threshold used for deposits and withdrawals. 
  /// @notice If the threshold is not met the deposit/ withdrawal is not executed.
  /// @dev Take into account the uScale (scale of the underlying).
  /// @param _marginScale Value at which to set the marginScale.
  function setMarginScale(int256 _marginScale) external onlyDao {
    marginScale = _marginScale;
  }

  /// @notice Set the liquidityPerc, the amount of liquidity which should be held in the vault after rebalancing.
  /// @dev The actual liquidityPerc could be a bit more or a bit less than the liquidityPerc set here. 
  /// @dev This is because some deposits or withdrawals might not execute because they don't meet the marginScale. 
  /// @param _liquidityPerc Value at which to set the liquidityPerc.
  function setLiquidityPerc(uint256 _liquidityPerc) external onlyDao {
    require(_liquidityPerc <= 100, "Liquidity percentage cannot exceed 100%");
    liquidityPerc = _liquidityPerc;
  } 

  /// @notice Set the Uniswap Router address
  /// @param _uniswapRouter New Uniswap Router address
  function setUniswapRouter(address _uniswapRouter) external onlyDao {
    uniswapRouter = _uniswapRouter;
  }

  /// @notice Set the Uniswap Factory address
  /// @param _uniswapFactory New Uniswap Factory address
  function setUniswapFactory(address _uniswapFactory) external onlyDao {
    uniswapFactory = _uniswapFactory;
  }

}
