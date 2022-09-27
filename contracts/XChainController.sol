// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IXProvider.sol";

import "hardhat/console.sol";

contract XChainController {
  using SafeERC20 for IERC20;

  address public game;
  address public dao;
  address public xProviderAddr;
  IXProvider public xProvider;

  uint16[] public chainIds;
  uint16 public homeChain;

  struct vaultInfo {
    int256 totalCurrentAllocation;
    uint256 totalUnderlying;
    uint256 totalSupply;
    uint256 totalWithdrawalRequests;
    mapping(uint16 => bool) chainIdOff; // true == off // false == on
    mapping(uint16 => int256) currentAllocationPerChain; // chainId => allocation
    mapping(uint16 => uint256) totalUnderlyingPerChain; // chainId => totalUnderlying
    mapping(uint16 => address) vaultChainAddress; // chainId => vault address
    mapping(uint16 => address) vaultUnderlyingAddress; // chainId => underlying address e.g USDC
    mapping(uint16 => uint256) withdrawalRequests; // chainId => total withdrawal requests in LP Token
    mapping(uint16 => uint256) amountToDepositPerChain; // chainId => amountToDeposit
  }

  // activeVaults; number of active vaults for vaultNumber, set in XChainRebalance
  // stage 0 Ready; waiting for game to send allocations
  // stage 1 AllocationsReceived; allocations received from game, ready to rebalance XChain and set activeVaults
  // stage 2 UnderlyingReceived; underlyings received from all active vault contracts
  // stage 3 FundsReceived; funds received from all active vault contracts
  struct vaultStages {
    uint256 activeVaults;
    bool ready; // stage 0
    bool allocationsReceived; // stage 1
    uint256 underlyingReceived; // stage 2
    uint256 fundsReceived; // stage 3
  }

  mapping(uint256 => vaultInfo) internal vaults;
  mapping(uint256 => vaultStages) internal vaultStage;

  modifier onlyGame {
    require(msg.sender == game, "xController: only Game");
    _;
  }

  modifier onlyDao {
    require(msg.sender == dao, "xController: only DAO");
    _;
  }

  modifier onlyXProvider {
    require(msg.sender == xProviderAddr, "xController: only xProviderAddr");
    _;
  }

  // vaultStage 0
  modifier onlyWhenReady(uint256 _vaultNumber) {
    require(
      vaultStage[_vaultNumber].ready, 
      "Not all vaults are ready"
    );
    _;
  }

  // vaultStage 1
  modifier onlyWhenAllocationsReceived(uint256 _vaultNumber) {
    require(
      vaultStage[_vaultNumber].allocationsReceived, 
      "Allocations not received from game"
    );
    _;
  }

  // vaultStage 2
  modifier onlyWhenUnderlyingsReceived(uint256 _vaultNumber) {
    require(
      vaultStage[_vaultNumber].underlyingReceived == vaultStage[_vaultNumber].activeVaults, 
      "Not all underlyings received"
    );
    _;
  }

  // vaultStage 3
  modifier onlyWhenFundsReceived(uint256 _vaultNumber) {
    require(
      vaultStage[_vaultNumber].fundsReceived == vaultStage[_vaultNumber].activeVaults, 
      "Not all funds received"
    );
    _;
  }

  constructor(address _game, address _dao, uint16 _homeChain) {
    game = _game;
    dao = _dao;
    homeChain = _homeChain;
  }

  /// @notice Setter for number of active vaults for vaultNumber, set in xChainRebalance
  /// @param _vaultNumber Number of the vault
  /// @param _activeVaults Number active vaults, calculated in xChainRebalance
  function setActiveVaults(uint256 _vaultNumber, uint256 _activeVaults) internal {
    vaultStage[_vaultNumber].activeVaults = _activeVaults;
  }

  /// @notice Setter for stage 0: 
  /// @notice Ready; waiting for game to send allocations
  function setReady(uint256 _vaultNumber, bool _state) internal {
    vaultStage[_vaultNumber].ready = _state;
  }

  /// @notice Setter for stage 1: 
  /// @notice AllocationsReceived; allocations received from game, ready to rebalance XChain and set activeVaults
  function setAllocationsReceived(uint256 _vaultNumber, bool _state) internal onlyWhenReady(_vaultNumber) {
    vaultStage[_vaultNumber].allocationsReceived = _state;
  }

  /// @notice Setter to tick up stage 2: 
  /// @notice UnderlyingReceived; underlyings received from all active vault contracts
  function upUnderlyingReceived(uint256 _vaultNumber) internal onlyWhenAllocationsReceived(_vaultNumber) {
    vaultStage[_vaultNumber].underlyingReceived++;
  }

  /// @notice Setter to tick up stage 3: 
  /// @notice FundsReceived; funds received from all active vault contracts
  function upFundsReceived(uint256 _vaultNumber) external onlyXProvider onlyWhenUnderlyingsReceived(_vaultNumber) {
    vaultStage[_vaultNumber].fundsReceived++;
  }

  /// @notice Resets all stages in vaultStage struct for a vaultNumber
  /// @dev onlyDao modifier so the dao can reset all stages for a vaultNumber incase something goes wrong
  function resetVaultStagesDao(uint256 _vaultNumber) external onlyDao {
    return resetVaultStages(_vaultNumber);
  }

  /// @notice Resets all stages in vaultStage struct for a vaultNumber
  function resetVaultStages(uint256 _vaultNumber) internal {
    vaultStage[_vaultNumber].ready = true;
    vaultStage[_vaultNumber].allocationsReceived = false;
    vaultStage[_vaultNumber].underlyingReceived = 0;
    vaultStage[_vaultNumber].fundsReceived = 0;
  }

  /// @notice Resets underlying for a vaultNumber at the start of a rebalancing period
  function resetVaultUnderlying(uint256 _vaultNumber) internal {
    vaults[_vaultNumber].totalUnderlying = 0;
    vaultStage[_vaultNumber].underlyingReceived = 0;
  }

  /// @notice Resets underlying for a vaultNumber per chainId at the start of a rebalancing period
  function resetVaultUnderlyingForChain(uint256 _vaultNumber, uint16 _chainId) internal {
    vaults[_vaultNumber].totalUnderlyingPerChain[_chainId] = 0;
  }

  /// @notice Step 2; Used by game to send allocations to xChainController
  /// @param _vaultNumber Number of Vault
  /// @param _deltas Delta allocations array received from game, indexes match chainIds[] set in this contract
  function receiveAllocationsFromGame(
    uint256 _vaultNumber, 
    int256[] memory _deltas
  ) external onlyXProvider onlyWhenReady(_vaultNumber) {
    uint256 activeVaults;

    for (uint256 i = 0; i < chainIds.length; i++) {
      uint16 chain = chainIds[i];
      activeVaults += settleCurrentAllocation(_vaultNumber, chain, _deltas[i]);
      resetVaultUnderlyingForChain(_vaultNumber, chain);
    }

    resetVaultUnderlying(_vaultNumber);
    setActiveVaults(_vaultNumber, activeVaults);
    setAllocationsReceived(_vaultNumber, true);
    setReady(_vaultNumber, false);
  }

  /// @notice Helper to settle the total current allocation with the delta allocations received from Game
  /// @notice Will set a chainId on/off depending on the currentAllocation and incoming deltaAllocation
  /// @dev if currentAllocation = 0 and deltaAllocation = 0, chainId will be set to Off
  /// @param _vaultNumber Number of Vault
  /// @param _chainId Number of chain used
  /// @param _deltas Delta allocations array received from game, indexes match chainIds[] set in this contract
  function settleCurrentAllocation(
    uint256 _vaultNumber, 
    uint16 _chainId, 
    int256 _deltas
  ) internal returns(uint256 activeVault) {
    if (getCurrentAllocation(_vaultNumber, _chainId) == 0 && _deltas == 0) {
      vaults[_vaultNumber].chainIdOff[_chainId] = true;
      activeVault = 0;
    } else {
      vaults[_vaultNumber].chainIdOff[_chainId] = false;
      activeVault = 1;
    }

    vaults[_vaultNumber].totalCurrentAllocation += _deltas;
    vaults[_vaultNumber].currentAllocationPerChain[_chainId] += _deltas;

    require(vaults[_vaultNumber].totalCurrentAllocation >= 0, "Allocation underflow");
  }

  /// @notice Step 3 receiver, trigger in vaults.
  /// @notice Receive and set totalUnderlyings from the vaults for every chainId
  /// @param _vaultNumber number of the vault
  /// @param _chainId Number of chain used
  /// @param _underlying totalUnderling plus vault balance in vaultcurrency e.g USDC
  /// @param _totalSupply Supply of the LP token of the vault on given chainId
  /// @param _withdrawalRequests Total amount of withdrawal requests from the vault in LP Tokens
  function setTotalUnderlying(
    uint256 _vaultNumber, 
    uint16 _chainId, 
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  ) external onlyXProvider onlyWhenAllocationsReceived(_vaultNumber) {
    require(getTotalUnderlyingOnChain(_vaultNumber, _chainId) == 0, "TotalUnderlying already set");

    vaults[_vaultNumber].totalUnderlyingPerChain[_chainId] = _underlying;
    vaults[_vaultNumber].withdrawalRequests[_chainId] = _withdrawalRequests;
    vaults[_vaultNumber].totalSupply += _totalSupply;
    vaults[_vaultNumber].totalUnderlying += _underlying;
    vaults[_vaultNumber].totalWithdrawalRequests += _withdrawalRequests;
    vaultStage[_vaultNumber].underlyingReceived ++;
  }

  /// @notice Step 4 trigger
  /// @notice Calculates the amounts the vaults on each chainId have to send or receive
  /// @param _vaultNumber Number of vault
  function pushVaultAmounts(uint256 _vaultNumber) external onlyWhenUnderlyingsReceived(_vaultNumber) {
    int256 totalAllocation = getCurrentTotalAllocation(_vaultNumber);
    uint256 totalWithdrawalRequests = getTotalWithdrawalRequests(_vaultNumber);
    uint256 totalUnderlying = getTotalUnderlyingVault(_vaultNumber) - totalWithdrawalRequests;
    uint256 totalSupply = getTotalSupply(_vaultNumber); 

    uint256 decimals = xProvider.getDecimals(getVaultAddress(_vaultNumber, homeChain));
    uint256 newExchangeRate = totalUnderlying * (10 ** decimals) / totalSupply;
    
    for (uint i = 0; i < chainIds.length; i++) {
      uint16 chain = chainIds[i];
      if (getVaultChainIdOff(_vaultNumber, chain)) continue;

      int256 amountToChain = calcAmountToChain(_vaultNumber, chain, totalUnderlying, totalAllocation);
      (int256 amountToDeposit, uint256 amountToWithdraw) = calcDepositWithdraw(_vaultNumber, chain, amountToChain);

      sendXChainAmount(_vaultNumber, chain, amountToDeposit, amountToWithdraw, newExchangeRate);
    }
  }

  /// @notice Calculates the amounts the vaults on each chainId have to send or receive 
  /// @param _vaultNumber number of the vault
  /// @param _chainId Number of chain used
  /// @param _amountToChain Amount in vaultcurrency that should be on given chainId
  function calcDepositWithdraw(
    uint256 _vaultNumber, 
    uint16 _chainId, 
    int256 _amountToChain
  ) internal view returns(int256, uint256) {
    uint256 currentUnderlying = getTotalUnderlyingOnChain(_vaultNumber, _chainId);
    
    int256 amountToDeposit = _amountToChain - int256(currentUnderlying);
    uint256 amountToWithdraw = amountToDeposit < 0 ? currentUnderlying - uint256(_amountToChain) : 0;

    return (amountToDeposit, amountToWithdraw);
  }

  /// @notice Calculates the amounts the vaults has to send back to the xChainController
  /// @param _totalUnderlying Total underlying on all chains for given vaultNumber
  /// @param _totalAllocation Total allocation on all chains for given vaultNumber
  function calcAmountToChain(
    uint256 _vaultNumber,
    uint16 _chainId,
    uint256 _totalUnderlying,
    int256 _totalAllocation
  ) internal view returns(int256) {
    int256 allocation = getCurrentAllocation(_vaultNumber, _chainId);
    uint256 withdrawalRequests = getWithdrawalRequests(_vaultNumber, _chainId);

    int256 amountToChain = int(_totalUnderlying) * allocation / _totalAllocation;
    amountToChain += int(withdrawalRequests);

    return amountToChain;
  }

  /// @notice Sends out cross-chain messages to vaults with the amount the vault has to send back
  /// @dev if the xChainController needs to deposit, the amount will be 0 so the vault knows it will receive currency
  /// @param _amountDeposit Amount the vault will receive from the xChainController
  /// @param _amountToWithdraw Amount the vault will have to send back to the xChainController
  /// @param _exchangeRate New exchangerate for vaults
  function sendXChainAmount(
    uint256 _vaultNumber, 
    uint16 _chainId, 
    int256 _amountDeposit,
    uint256 _amountToWithdraw,
    uint256 _exchangeRate
  ) internal {
    address vault = getVaultAddress(_vaultNumber, _chainId);

    if (_amountDeposit > 0) {
      setAmountToDeposit(_vaultNumber, _chainId, _amountDeposit);
      xProvider.pushSetXChainAllocation(vault, _chainId, 0, _exchangeRate);
      vaultStage[_vaultNumber].fundsReceived++;
    }

    if (_amountToWithdraw > 0) {
      xProvider.pushSetXChainAllocation(vault, _chainId, _amountToWithdraw, _exchangeRate);
    }
  }

  /// @notice Step 5 trigger
  /// @notice Send amount to deposit from xController to vault and reset all stages for the vault
  /// @param _vaultNumber Number of vault
  function sendFundsToVault(uint256 _vaultNumber) external onlyWhenFundsReceived(_vaultNumber) {
    for (uint i = 0; i < chainIds.length; i++) {
      uint16 chain = chainIds[i];
      if (getVaultChainIdOff(_vaultNumber, chain)) continue;

      uint256 amountToDeposit = getAmountToDeposit(_vaultNumber, chain);

      if (amountToDeposit > 0) {
        address underlying = getUnderlyingAddress(_vaultNumber, chain);

        IERC20(underlying).safeIncreaseAllowance(xProviderAddr, amountToDeposit);
        xProvider.xTransferToVaults(
          getVaultAddress(_vaultNumber, chain), 
          chain, 
          amountToDeposit, 
          underlying
        );
        setAmountToDeposit(_vaultNumber, chain, 0);
      }
    }

    resetVaultStages(_vaultNumber);
  }

  /// @notice Helper to get total current allocation of vaultNumber
  function getTotalUnderlyingOnChain(uint256 _vaultNumber, uint16 _chainId) internal view returns(uint256) {
    return vaults[_vaultNumber].totalUnderlyingPerChain[_chainId];
  }

  /// @notice Gets saved totalUnderlying for vaultNumber
  function getTotalUnderlyingVault(uint256 _vaultNumber) internal view onlyWhenUnderlyingsReceived(_vaultNumber) returns(uint256) {
    return vaults[_vaultNumber].totalUnderlying;
  }

  /// @notice Helper to get vault address of vaultNumber with given chainID
  function getVaultAddress(uint256 _vaultNumber, uint16 _chainId) internal view returns(address) {
    return vaults[_vaultNumber].vaultChainAddress[_chainId];
  }

  /// @notice Helper to get underyling address of vaultNumber with given chainID eg USDC
  function getUnderlyingAddress(uint256 _vaultNumber, uint16 _chainId) internal view returns(address) {
    return vaults[_vaultNumber].vaultUnderlyingAddress[_chainId];
  }

  /// @notice Helper to get current allocation per chain of vaultNumber with given chainID
  function getCurrentAllocation(uint256 _vaultNumber, uint16 _chainId) internal view returns(int256) {
    return vaults[_vaultNumber].currentAllocationPerChain[_chainId];
  }

  /// @notice Helper to get total current allocation of vaultNumber
  function getCurrentTotalAllocation(uint256 _vaultNumber) internal view returns(int256) {
    return vaults[_vaultNumber].totalCurrentAllocation;
  }

  /// @notice Helper to get if vault is active or not
  function getVaultChainIdOff(uint256 _vaultNumber, uint16 _chainId) public view returns(bool) {
    return vaults[_vaultNumber].chainIdOff[_chainId];
  }

  /// @notice Helper to set the amount to deposit in a chain vault
  function setAmountToDeposit(uint256 _vaultNumber, uint16 _chainId, int256 _amountToDeposit) internal {
    vaults[_vaultNumber].amountToDepositPerChain[_chainId] = uint256(_amountToDeposit);
  }

  /// @notice Helper to get the amount to deposit in a chain vault
  function getAmountToDeposit(uint256 _vaultNumber, uint16 _chainId) internal view returns(uint256) {
    return vaults[_vaultNumber].amountToDepositPerChain[_chainId];
  }

  /// @notice Helper to get total supply from the vault on given chainId
  function getTotalSupply(uint256 _vaultNumber) internal view returns(uint256) {
    return vaults[_vaultNumber].totalSupply;
  }

  /// @notice Helper to get withdrawal requests from the vault on given chainId
  function getWithdrawalRequests(uint256 _vaultNumber, uint16 _chainId) internal view returns(uint256) {
    return vaults[_vaultNumber].withdrawalRequests[_chainId];
  }

  /// @notice Helper to get total withdrawal requests from the vault on given chainId
  function getTotalWithdrawalRequests(uint256 _vaultNumber) internal view returns(uint256) {
    return vaults[_vaultNumber].totalWithdrawalRequests;
  }

  /// @notice Set Vault address and underlying for a particulair chainId
  /// @param _vaultNumber number of Vault
  /// @param _chainId Number of chain used
  /// @param _address address of the Vault
  /// @param _underlying underlying of the Vault eg USDC
  function setVaultChainAddress(
    uint256 _vaultNumber, 
    uint16 _chainId, 
    address _address, 
    address _underlying
  ) external onlyDao{
    vaults[_vaultNumber].vaultChainAddress[_chainId] = _address; 
    vaults[_vaultNumber].vaultUnderlyingAddress[_chainId] = _underlying;
  }

  /// @notice Setter for xProvider address
  /// @param _xProvider new address of xProvider on this chain
  function setHomeXProviderAddress(address _xProvider) external onlyDao {
    xProvider = IXProvider(_xProvider);
    xProviderAddr = _xProvider;
  }

  /// @notice Setter for chainId array
  /// @param _chainIds array of all the used chainIds
  function setChainIdArray(uint16[] memory _chainIds) external onlyDao {
    chainIds = _chainIds;
  }
}