// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IETFVault.sol";
import "./Interfaces/IController.sol";
import "./Interfaces/IGoverned.sol";

import "./VaultToken.sol";
import "./libraries/swap.sol";

import "hardhat/console.sol";

// ToDo: figure out when to transact from vault to protocols --> on rebalancing OR on vault funds treshhold?
// ToDo: how to do automatic yield farming? --> Swap in uniswap.

contract ETFVault is VaultToken {
  using SafeERC20 for IERC20;
  // name of the ETF e.g. yield_defi_usd_low (a yield token ETF in DeFi in UDS with low risk) or yield_defi_btc_high or exchange_stocks_usd_mid
  string public ETFname;
  uint256 public ETFnumber;

  IERC20 public vaultCurrency;
  IController public controller;

  enum State { WaitingForController, SendingFundsXChain, WaitingForFunds, RebalanceVault }
  State public state;

  address public vaultCurrencyAddr; 
  address public ETFgame;
  address public governed;
  address public xChainController;

  int256 public marginScale = 1E10; // 10000 USDC
  uint256 public uScale;
  uint256 public liquidityPerc = 10;
  uint256 public performanceFee = 10;
  uint256 public rebalancingPeriod = 0;

  uint256 public blockRebalanceInterval = 1;
  uint256 public lastTimeStamp;

  uint256 public gasFeeLiquidity;
  uint256 public amountToSendXChain;

  // total number of allocated xaver tokens currently
  int256 public totalAllocatedTokens;

  // current allocations over the protocols 
  mapping(uint256 => int256) internal currentAllocations;

  // delta of the total number of xaver tokens allocated on next rebalancing
  int256 private deltaAllocatedTokens;

  // delta of the portfolio on next rebalancing
  mapping(uint256 => int256) internal deltaAllocations;

  // historical reward per protocol per token, formula: TVL * yield * perfFee / totalLockedTokens
  // first index is rebalancing period, second index is protocol id.
  mapping(uint256 => mapping(uint256 => int256)) public rewardPerLockedToken;

  // historical prices, first index is rebalancing period, second index is protocol id.
  mapping(uint256 => mapping(uint256 => uint256)) public historicalPrices;

  event GasPaidRebalanceETF(uint256 gasInVaultCurrency);

  modifier onlyETFgame {
    require(msg.sender == ETFgame, "ETFvault: only ETFgame");
    _;
  }

  modifier onlyDao {
    require(msg.sender == governed, "ETFvault: only DAO");
    _;
  }

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    string memory _ETFname,
    uint256 _ETFnumber,
    address _governed,
    address _ETFGame, 
    address _controller, 
    address _vaultCurrency,
    uint256 _uScale,
    uint256 _gasFeeLiquidity
    ) VaultToken (_name, _symbol, _decimals) {
    controller = IController(_controller);
    vaultCurrency = IERC20(_vaultCurrency);
    vaultCurrencyAddr = _vaultCurrency;

    ETFname = _ETFname;
    ETFnumber = _ETFnumber;

    governed = _governed;
    ETFgame = _ETFGame;
    uScale = _uScale;
    gasFeeLiquidity = _gasFeeLiquidity;
    lastTimeStamp = block.timestamp;
  }

  /// @notice Deposit in ETFVault
  /// @dev Deposit VaultCurrency to ETFVault and mint LP tokens
  /// @param _buyer Address from buyer of the tokens
  /// @param _amount Amount to deposit
  /// @return shares Tokens received by buyer
  function depositETF(address _buyer, uint256 _amount) external returns(uint256 shares) {
    uint256 balanceBefore = vaultCurrency.balanceOf(address(this));
    vaultCurrency.safeTransferFrom(_buyer, address(this), _amount);
    uint256 balanceAfter = vaultCurrency.balanceOf(address(this));

    uint256 amount = balanceAfter - balanceBefore;
    uint256 totalSupply = totalSupply();

    if (totalSupply > 0) {
      // using historicalUnderlying[rebalancingPeriod] instead of getTotalUnderlying() will cause a small discrepancy but is more gas efficient
      shares = ( amount * totalSupply ) / (getTotalUnderlying() + balanceBefore); 
    } else {
      shares = amount; 
    }
    
    _mint(_buyer, shares); 
  }

  /// @notice Withdraw from ETFVault
  /// @dev Withdraw VaultCurrency from ETFVault and burn LP tokens
  /// @param _seller Address from seller of the tokens
  /// @param _amount Amount to withdraw in LP tokens
  /// @return value Amount received by seller in vaultCurrency
  function withdrawETF(address _seller, uint256 _amount) external returns(uint256 value) {
    value = _amount * exchangeRate() / uScale;
    require(value > 0, "no value");

    if (value > vaultCurrency.balanceOf(address(this))) pullFunds(value);
      
    _burn(_seller, _amount);
    vaultCurrency.safeTransfer(_seller, value);
  }

  // xchainprovider modifier?
  /// @notice Will set the amount to send back to the xChainController by the xChainController
  /// @dev Sets the amount and state so the dao can trigger the rebalanceXChain function
  /// @dev When amount == 0 the vault doesnt need to send anything and will wait for funds from the xChainController
  /// @param _amountToSend amount to send in vaultCurrency
  function setAllocationXChain(uint256 _amountToSend) external {
    amountToSendXChain = _amountToSend;

    if (_amountToSend == 0) {
      state = State.WaitingForFunds;
    } else {
      state = State.SendingFundsXChain;
    }
  }

  // OnlyDao modifier
  /// @notice Will be replaced with xChain logic
  function rebalanceXChain() external onlyDao {
    if (state != State.SendingFundsXChain) return;

    vaultCurrency.safeTransfer(xChainController, amountToSendXChain);
    amountToSendXChain = 0;
    state = State.RebalanceVault;
  }

  /// @notice Temporary helper to set state
  function setVaultStateTEMP() public {
    state = State.RebalanceVault;
  }

  /// @notice Temporary helper to get total underlying plus vault balance
  function getTotalUnderlyingTEMP() public view returns(uint256 underlying) {
    underlying += getTotalUnderlying();
    underlying += vaultCurrency.balanceOf(address(this));
  }

  /// @notice Withdraw from protocols on shortage in Vault
  /// @dev Keeps on withdrawing until the Vault balance > _value
  /// @param _value The total value of vaultCurrency an user is trying to withdraw. 
  /// @param _value The (value - current underlying value of this vault) is withdrawn from the underlying protocols.
  function pullFunds(uint256 _value) internal {
    for (uint i = 0; i < controller.latestProtocolId(ETFnumber); i++) {
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

    // using historicalUnderlying[rebalancingPeriod] instead of getTotalUnderlying() will cause a small discrepancy but is more gas efficient
    return (getTotalUnderlying() + balanceSelf)  * uScale / totalSupply();
  }

  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev amountToProtocol = totalAmount * currentAllocation / totalAllocatedTokens
  /// @dev amountToDeposit = amountToProtocol - currentBalanceProtocol
  /// @dev if amountToDeposit < 0 => withdraw
  /// @dev Execute all withdrawals before deposits
  function rebalanceETF() external onlyDao {
    if (!rebalanceNeeded()) return;
    // if (state != State.RebalanceVault) return; // commented out for now so the tests wont fail
    uint256 gasStart = gasleft();

    rebalancingPeriod++;
    
    claimTokens(); 
    
    uint256 totalUnderlying = getTotalUnderlying();
    uint256 totalUnderlyingInclVaultBalance = totalUnderlying + vaultCurrency.balanceOf(address(this));
    uint256 liquidityVault = totalUnderlyingInclVaultBalance * liquidityPerc / 100;

    totalAllocatedTokens += deltaAllocatedTokens;
    deltaAllocatedTokens = 0;
    
    uint256[] memory protocolToDeposit = rebalanceCheckProtocols(totalUnderlyingInclVaultBalance - liquidityVault);
    executeDeposits(protocolToDeposit);

    lastTimeStamp = block.timestamp;
    
    if (vaultCurrency.balanceOf(address(this)) < gasFeeLiquidity) pullFunds(gasFeeLiquidity);

    uint256 gasUsed = gasStart - gasleft();
    swapAndPayGasFee(gasUsed);

    state = State.WaitingForController;
  }

  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev Loops over all protocols in ETF, calculate new currentAllocation based on deltaAllocation
  /// @dev Also calculate the performance fee here. This is an amount, based on the current TVL (before the rebalance),  
  /// @dev the performanceFee and difference between the current exchangeRate and the exchangeRate of the last rebalance of the vault. 
  /// @param _newTotalUnderlying this will be the new total underlying: Totalunderlying = TotalUnderlyingInProtocols - BalanceVault 
  /// @return uint256[] with amounts to deposit in protocols, the index being the protocol number. 
  function rebalanceCheckProtocols(uint256 _newTotalUnderlying) internal returns(uint256[] memory){
    uint256[] memory protocolToDeposit = new uint[](controller.latestProtocolId(ETFnumber));
    for (uint i = 0; i < controller.latestProtocolId(ETFnumber); i++) {
      bool isBlacklisted = controller.getProtocolBlacklist(ETFnumber, i);

      storePriceAndRewards(_newTotalUnderlying, i);

      if (deltaAllocations[i] == 0 || isBlacklisted) continue;
  
      setAllocation(i);
      
      int256 amountToProtocol;
      if (totalAllocatedTokens == 0) amountToProtocol = 0;
      else amountToProtocol = int(_newTotalUnderlying) * currentAllocations[i] / totalAllocatedTokens; 

      uint256 currentBalance = balanceUnderlying(i);

      int256 amountToDeposit = amountToProtocol - int(currentBalance);
      uint256 amountToWithdraw = amountToDeposit < 0 ? currentBalance - uint(amountToProtocol) : 0;
      
      if (amountToDeposit > marginScale) protocolToDeposit[i] = uint256(amountToDeposit); 
      if (amountToWithdraw > uint(marginScale) || currentAllocations[i] == 0) withdrawFromProtocol(i, amountToWithdraw);
    }
    
    return protocolToDeposit;
  }

  /// @notice Stores the historical price and the reward per locked token.
  /// @dev formula yield protocol i at time t: y(it) = (P(it) - P(it-1)) / P(it-1).
  /// @dev formula rewardPerLockedToken for protocol i at time t: r(it) = y(it) * TVL(t) * perfFee(t) / totalLockedTokens(t)
  /// @dev later, when the total rewards are calculated for a game player we multiply this (r(it)) by the locked tokens on protocol i at time t 
  /// @param _totalUnderlying Totalunderlying = TotalUnderlyingInProtocols - BalanceVault.
  /// @param protocolId Protocol id number.
  function storePriceAndRewards(uint256 _totalUnderlying, uint256 protocolId) internal {
      uint256 price = price(protocolId);
      historicalPrices[rebalancingPeriod][protocolId] = price;
      if (historicalPrices[rebalancingPeriod - 1][protocolId] == 0) return;
      int256 priceDiff = int256(price - historicalPrices[rebalancingPeriod - 1][protocolId]);
      int256 nominator = int256(_totalUnderlying * performanceFee) * priceDiff;
      int256 denominator = totalAllocatedTokens * int256(historicalPrices[rebalancingPeriod - 1][protocolId]) * 100; // * 100 cause perfFee is in percentages
      if (totalAllocatedTokens == 0) {
        rewardPerLockedToken[rebalancingPeriod][protocolId] = 0;
      } else {
        rewardPerLockedToken[rebalancingPeriod][protocolId] = nominator / denominator;
      }
  }

  /// @notice Swaps the gas used from RebalanceETF, from vaultcurrency to ETH and send it to the dao
  /// @notice This way the vault will pay the gas for the RebalanceETF function
  /// @param _gasUsed total gas used by RebalanceETF
  function swapAndPayGasFee(uint256 _gasUsed) internal {
    uint256 amountEtherToVaultCurrency = Swap.amountOutSingleSwap(
      (_gasUsed + Swap.gasUsedForSwap) * controller.getGasPrice(),
      Swap.WETH,
      vaultCurrencyAddr,
      controller.uniswapQuoter(),
      controller.uniswapPoolFee()
    );

    uint256 wethReceived = Swap.swapTokensSingle(
      amountEtherToVaultCurrency, 
      vaultCurrencyAddr, 
      Swap.WETH,
      controller.uniswapRouter(),
      controller.uniswapQuoter(),
      controller.uniswapPoolFee()
    );
    Swap.unWrapWETHtoGov(payable(governed), wethReceived);

    emit GasPaidRebalanceETF(amountEtherToVaultCurrency);
  }

  /// @notice Checks if a rebalance is needed based on the set block interval 
  /// @return bool True of rebalance is needed, false if not
  function rebalanceNeeded() public view returns(bool) {
    return (block.timestamp - lastTimeStamp) > blockRebalanceInterval;
  }

  /// @notice Helper function to set allocations
  /// @param _i Protocol number linked to an underlying protocol e.g compound_usdc_01
  function setAllocation(uint256 _i) internal {
    currentAllocations[_i] += deltaAllocations[_i];
    deltaAllocations[_i] = 0;
    require(currentAllocations[_i] >= 0, "Current Allocation underflow");
  }

  /// @notice Helper function so the rebalance will execute all withdrawals first
  /// @dev Executes and resets all deposits set in mapping(protocolToDeposit) by rebalanceETF
  /// @param protocolToDeposit array with amounts to deposit in protocols, the index being the protocol number. 
  function executeDeposits(uint256[] memory protocolToDeposit) internal {
    for (uint i = 0; i < controller.latestProtocolId(ETFnumber); i++) {
      uint256 amount = protocolToDeposit[i];
      if (amount == 0) continue;

      depositInProtocol(i, amount);
    }
  }

  /// @notice Deposit amount to underlying protocol
  /// @dev Deposits VaultCurrency in Protocol e.g USDC
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to deposit
  function depositInProtocol(uint256 _protocolNum, uint256 _amount) internal {
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(ETFnumber, _protocolNum);

    if (vaultCurrency.balanceOf(address(this)) < _amount) _amount = vaultCurrency.balanceOf(address(this));
  
    if (protocol.underlying != vaultCurrencyAddr) {
      _amount = Swap.swapStableCoins(
        _amount, 
        vaultCurrencyAddr, 
        protocol.underlying,
        uScale,
        controller.underlyingUScale(protocol.underlying),
        controller.curveIndex(vaultCurrencyAddr), 
        controller.curveIndex(protocol.underlying),
        controller.curve3Pool(),
        controller.curve3PoolFee()
      );
    }

    IERC20(protocol.underlying).safeIncreaseAllowance(protocol.provider, _amount);
    controller.deposit(ETFnumber, _protocolNum, address(this), _amount);

    console.log("deposited: %s, Protocol: %s", (uint(_amount)/ uScale), _protocolNum);
  }

  /// @notice Withdraw amount from underlying protocol
  /// @dev shares = amount / PricePerShare
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to withdraw
  function withdrawFromProtocol(uint256 _protocolNum, uint256 _amount) internal {
    if (_amount > 0) {
      IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(ETFnumber, _protocolNum);

      _amount = _amount * protocol.uScale / uScale;

      uint256 shares = controller.calcShares(ETFnumber, _protocolNum, _amount);
      IERC20(protocol.LPToken).safeIncreaseAllowance(protocol.provider, shares);

      uint256 amountReceived = controller.withdraw(ETFnumber, _protocolNum, address(this), shares);

      if (protocol.underlying != vaultCurrencyAddr) {
        _amount = Swap.swapStableCoins(
          amountReceived, 
          protocol.underlying,
          vaultCurrencyAddr, 
          controller.underlyingUScale(protocol.underlying),
          uScale,
          controller.curveIndex(protocol.underlying), 
          controller.curveIndex(vaultCurrencyAddr),
          controller.curve3Pool(),
          controller.curve3PoolFee()
        );
      }
    }
    console.log("withdrawed: %s, Protocol: %s", (uint(_amount) / uScale), _protocolNum);
  }

  /// @notice Get total balance in VaultCurrency in all underlying protocols
  /// @return balance Total balance in VaultCurrency e.g USDC
  function getTotalUnderlying() public view returns(uint256 balance) {   
    uint gasStart = gasleft();
    
    for (uint i = 0; i < controller.latestProtocolId(ETFnumber); i++) {
      if (currentAllocations[i] == 0) continue;
      balance += balanceUnderlying(i);
    }

    uint256 gasUsed = gasStart - gasleft();
  }

  /// @notice Get balance in VaultCurrency in underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return Balance in VaultCurrency e.g USDC
  function balanceUnderlying(uint256 _protocolNum) public view returns(uint256) {
    uint256 protocolUScale = controller.getProtocolInfo(ETFnumber, _protocolNum).uScale;
    uint256 underlyingBalance = controller.balanceUnderlying(ETFnumber, _protocolNum, address(this)) * uScale / protocolUScale;
    return underlyingBalance;
  }

  /// @notice Calculates how many shares are equal to the amount in vault currency
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount Amount in underyling token e.g USDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _protocolNum, uint256 _amount) public view returns(uint256) {
    uint256 protocolUScale = controller.getProtocolInfo(ETFnumber, _protocolNum).uScale;
    uint256 shares = controller.calcShares(ETFnumber, _protocolNum, _amount * protocolUScale / uScale);
    // console.log("shares %s", shares);
    return shares;
  }

  /// @notice Get price for underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return protocolPrice Price per share
  function price(uint256 _protocolNum) public view returns(uint256) {
    return controller.exchangeRate(ETFnumber, _protocolNum);
  }

  /// @notice Set the delta allocated tokens by game contract
  /// @dev Allocation can be negative
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  /// @param _allocation Delta allocation in tokens
  function setDeltaAllocations(uint256 _protocolNum, int256 _allocation) external onlyETFgame {
    require(!controller.getProtocolBlacklist(ETFnumber, _protocolNum), "Protocol on blacklist");
    int256 deltaAllocation = deltaAllocations[_protocolNum] + _allocation;
    deltaAllocations[_protocolNum] = deltaAllocation;
    deltaAllocatedTokens += _allocation; 
  }

  /// @notice Harvest extra tokens from underlying protocols
  /// @dev Loops over protocols in ETF and check if they are claimable in controller contract
  function claimTokens() public {
    for (uint i = 0; i < controller.latestProtocolId(ETFnumber); i++) {
      if (currentAllocations[i] == 0) continue;
      bool claim = controller.claim(ETFnumber, i);

      if (claim) {
        address govToken = controller.getProtocolInfo(ETFnumber, i).govToken;
        uint256 tokenBalance = IERC20(govToken).balanceOf(address(this));
        
        Swap.swapTokensMulti(
          tokenBalance, 
          govToken, 
          vaultCurrencyAddr,
          controller.uniswapRouter(),
          controller.uniswapQuoter(),
          controller.uniswapPoolFee()
        );
      }
    }
  }

  /// @notice The DAO should be able to blacklist protocols, the funds should be sent to the vault.
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  function blacklistProtocol(uint256 _protocolNum) external onlyDao {
    uint256 balanceProtocol = balanceUnderlying(_protocolNum);
    currentAllocations[_protocolNum] = 0;
    controller.setProtocolBlacklist(ETFnumber, _protocolNum);
    withdrawFromProtocol(_protocolNum, balanceProtocol);
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
    require(_liquidityPerc <= 100, "Percentage cannot exceed 100%");
    liquidityPerc = _liquidityPerc;
  } 

  /// @notice Set the performanceFee, the percentage of the yield that goes to the game players.
  /// @dev The actual performanceFee could be a bit more or a bit less than the performanceFee set here due to approximations in the game. 
  /// @param _performanceFee Value at which to set the performanceFee.
  function setPerformanceFee(uint256 _performanceFee) external onlyDao {
    require(_performanceFee <= 100, "Percentage cannot exceed 100%");
    performanceFee = _performanceFee;
  }

  /// @notice Set the governance address
  /// @param _governed New address of the governance / DAO
  function setGovernedAddress(address _governed) external onlyDao {
    governed = _governed;
  }

  /// @notice Set the gasFeeLiquidity, liquidity in vaultcurrency which always should be kept in vault to pay for rebalance gas fee
  /// @param _gasFeeLiquidity Value at which to set the gasFeeLiquidity in vaultCurrency
  function setGasFeeLiquidity(uint256 _gasFeeLiquidity) external onlyDao {
    gasFeeLiquidity = _gasFeeLiquidity;
  }  

  /// @notice Set minimum block interval for the rebalance function
  /// @param _blockInterval number of blocks
  function setRebalanceInterval(uint256 _blockInterval) external onlyDao {
    blockRebalanceInterval = _blockInterval;
  }

  /// @notice redeem funds for basket in the game
  /// @dev function is implemented here because the vault holds the funds and can transfer them
  /// @param _user user (msg.sender) that triggered the redeemRewards function on the game contract.
  /// @param _amount the reward amount to be transferred to the user.
  function redeemRewards(address _user, uint256 _amount) external onlyETFgame {
      if (_amount > vaultCurrency.balanceOf(address(this))) pullFunds(_amount);
      vaultCurrency.safeTransfer(_user, _amount);
  }

  /// @notice callback to receive Ether from unwrapping WETH
  receive() external payable {
    require(msg.sender == Swap.WETH, "Not WETH");
  }

  /// @notice Temporary, will be replaced by xChain logic
  /// @param _xChainController set controller address
  function setxChainControllerAddress(address _xChainController) external {
    xChainController = _xChainController;
  }
}