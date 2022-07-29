// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IVault.sol";
import "./Interfaces/IXProvider.sol";

import "hardhat/console.sol";

contract XChainController {
  using SafeERC20 for IERC20;

  uint256 public latestChainId = 3; // will adjust at xchain implementation
  address public game;
  address public dao;
  address public xProviderAddr;
  IXProvider public xProvider;

  uint32 public homeChainId;
  uint32[] public chainIds = [10, 100];

  struct vaultInfo {
    int256 totalCurrentAllocation;
    uint256 totalUnderlying;
    uint256 underlyingReceived;
    uint256 allocationsReceived;
    mapping(uint32 => int256) currentAllocationPerChain; // chainId => allocation
    mapping(uint32 => uint256) totalUnderlyingPerChain; // chainId => totalUnderlying
    mapping(uint32 => address) vaultChainAddress; // chainId => vault address
    mapping(uint32 => address) vaultUnderlyingAddress; // chainId => underlying address e.g USDC
    mapping(uint32 => uint256) amountToDepositPerChain; // chainId => amountToDeposit
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
  mapping(uint32 => address) internal xProviders; // chainId => xProvider

  modifier onlyGame {
    require(msg.sender == game, "XChainController: only Game");
    _;
  }

  modifier onlyDao {
    require(msg.sender == dao, "XChainController: only DAO");
    _;
  }

  modifier onlyXProvider {
    require(msg.sender == xProviderAddr, "XChainController: only xProviderAddr");
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

  constructor(address _game, address _dao, uint32 _homeChainId) {
    // feedback vault state back to controller
    // transfers via provider
    game = _game;
    dao = _dao;
    homeChainId = _homeChainId;
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
  function upFundsReceived(uint256 _vaultNumber) internal onlyWhenUnderlyingsReceived(_vaultNumber) {
    vaultStage[_vaultNumber].fundsReceived++;
  }

  /// @notice Resets all stages in vaultStage struct for a vaultNumber
  /// @dev onlyDao modifier so the dao can reset all stages for a vaultNumber incase something goes wrong
  function resetVaultStages(uint256 _vaultNumber) public onlyDao {
    vaultStage[_vaultNumber].ready = true;
    vaultStage[_vaultNumber].allocationsReceived = false;
    vaultStage[_vaultNumber].underlyingReceived = 0;
    vaultStage[_vaultNumber].fundsReceived = 0;
  }

  /// @notice Step 1; Used by game to send allocations to xChainController
  /// @param _vaultNumber number of Vault
  /// @param _deltas delta allocations array received from game, indexes match chainIds[] set in this contract
  function receiveAllocationsFromGame(
    uint256 _vaultNumber, 
    int256[] memory _deltas
  ) external onlyXProvider onlyWhenReady(_vaultNumber) {
    for (uint256 i = 0; i < chainIds.length; i++) {
      settleCurrentAllocation(_vaultNumber, chainIds[i], _deltas[i]);
    }

    setAllocationsReceived(_vaultNumber, true);
    setReady(_vaultNumber, false);
  }

  /// @notice Helper to settle the total current allocation with the delta allocations received from Game
  /// @param _vaultNumber number of Vault
  /// @param _chainId number of chainId
  /// @param _deltas delta allocations array received from game, indexes match chainIds[] set in this contract
  function settleCurrentAllocation(uint256 _vaultNumber, uint32 _chainId, int256 _deltas) internal {
    vaults[_vaultNumber].totalCurrentAllocation += _deltas;
    vaults[_vaultNumber].currentAllocationPerChain[_chainId] += _deltas;
  }

  /// @notice Step 2 trigger 
  /// @notice Set total balance in vaultCurrency for an vaultNumber on all chains
  function setTotalUnderlying(uint256 _vaultNumber) external {
    vaults[_vaultNumber].totalUnderlying = 0;
    vaults[_vaultNumber].underlyingReceived = 0;

    for (uint i = 0; i < chainIds.length; i++) {
      uint32 chain = chainIds[i];
      address vault = getVaultAddress(_vaultNumber, homeChainId);
      require(vault != address(0), "No vault on this chainId");

      if (chain == homeChainId) setTotalUnderlyingHomeChain(_vaultNumber, vault);
      else xProvider.pushGetTotalUnderlying(_vaultNumber, vault, chain, xProviders[chain]);
    }
  }

  /// @notice Helper to get and set total underlying in XController from home chain
  function setTotalUnderlyingHomeChain(uint256 _vaultNumber, address _vault) internal {
    console.log("home chain");
    uint256 underlying = IVault(_vault).getTotalUnderlyingIncBalance();
    setTotalUnderlyingCallback(_vaultNumber, underlying);
  }

  function setTotalUnderlyingCallback(uint256 _vaultNumber, uint256 _underlying) internal {
    setTotalUnderlyingCallbackInt(_vaultNumber, homeChainId, _underlying);
  }

  function setTotalUnderlyingCallback(uint256 _vaultNumber, uint32 _chainId, uint256 _underlying) external onlyXProvider {
    setTotalUnderlyingCallbackInt(_vaultNumber, _chainId, _underlying);
  }

  /// @notice Step 2 callback
  /// @notice Callback to set totalUnderlying in XController
  /// @param _underlying total underlying in vault currency
  function setTotalUnderlyingCallbackInt(
    uint256 _vaultNumber, 
    uint32 _chainId, 
    uint256 _underlying
  ) internal {
    console.log("underlying callback %s", _underlying);
    vaults[_vaultNumber].totalUnderlyingPerChain[_chainId] = _underlying;
    vaults[_vaultNumber].totalUnderlying += _underlying;
    vaults[_vaultNumber].underlyingReceived ++;
  }

  /// @notice Rebalances i.e deposit or withdraw all cross chains for a given vaultNumber
  /// @dev 
  /// @param _vaultNumber number of Vault
  function rebalanceXChainAllocations(uint256 _vaultNumber) external onlyDao {
    // require(vaults[_vaultNumber].underlyingReceived == latestChainId, "Total underlying not set");
    // // Correct state for Controller needed
    // uint256 totalChainUnderlying = getTotalUnderlyingETF(_vaultNumber);
    // int256 totalAllocation = setInternalAllocation(_vaultNumber);

    // for (uint i = 1; i <= latestChainId; i++) {
    //   setXChainAllocation(_vaultNumber, i);
    //   address vaultAddress = getVaultAddress(_vaultNumber, i);

    //   int256 amountToChainVault = int(totalChainUnderlying) * getCurrentAllocation(_vaultNumber, i) / totalAllocation;

    //   (int256 amountToDeposit, uint256 amountToWithdraw) = calcDepositWithdraw(vaultAddress, amountToChainVault);

    //   if (amountToDeposit > 0) {
    //     vaults[_vaultNumber].amountToDepositPerChain[i] = uint256(amountToDeposit);
    //     IVault(vaultAddress).setAllocationXChain(0);
    //     // up state for vault
    //   }
    //   if (amountToWithdraw > 0) {
    //     IVault(vaultAddress).setAllocationXChain(amountToWithdraw);
    //   }
    // }
  }

  /// @notice Helper function so the rebalance will execute all withdrawals first and can wait for vaults to deposit
  /// @dev Executes and resets all deposits set in mapping(amountToDepositPerChain) by rebalanceXChainAllocations
  /// @param _vaultNumber number of Vault
  function executeDeposits(uint256 _vaultNumber) external onlyDao {
    // Correct state for Controller needed
    // for (uint i = 0; i <= latestChainId; i++) {
    //   uint256 amount = vaults[_vaultNumber].amountToDepositPerChain[i];
    //   if (amount == 0) continue;

    //   vaults[_vaultNumber].amountToDepositPerChain[i] = 0;
    //   IERC20(getUnderlyingAddress(_vaultNumber, i)).safeTransfer(getVaultAddress(_vaultNumber, i), amount);

    //   // TEMP
    //   IVault(getVaultAddress(_vaultNumber, i)).setVaultState(3);
    // }
  }

  /// @notice Get total balance in vaultCurrency for an vaultNumber in all chains
  /// @param _vaultNumber number of Vault
  function setTotalChainUnderlying(uint256 _vaultNumber) public {
    // vaults[_vaultNumber].totalChainUnderlying = 0;

    // for (uint i = 1; i <= latestChainId; i++) {
    //   bytes4 selector = bytes4(keccak256("getTotalUnderlying(uint256,address)"));
    //   bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, getVaultAddress(_vaultNumber, i));

    //   xProvider.xCall(xProviderAddr, i, callData);
    // }
  }
  
  function addTotalChainUnderlying(uint256 _vaultNumber, uint256 _amount) external {
    // vaults[_vaultNumber].totalChainUnderlying += _amount;
    // vaults[_vaultNumber].underlyingReceived ++;
  }

  function calcDepositWithdraw(address _vault, int256 _amountToChain) internal view returns(int256, uint256) {
    // uint256 currentUnderlying = IVault(_vault).getTotalUnderlyingIncBalance();

    // int256 amountToDeposit = _amountToChain - int256(currentUnderlying);
    // uint256 amountToWithdraw = amountToDeposit < 0 ? currentUnderlying - uint256(_amountToChain) : 0;

    // return (amountToDeposit, amountToWithdraw);
  }

  /// @notice Gets saved totalUnderlying for vaultNumber
  function getTotalUnderlyingETF(uint256 _vaultNumber) public view returns(uint256) {
    // require(vaults[_vaultNumber].underlyingReceived == latestChainId, "Not all vaults set");
    // return vaults[_vaultNumber].totalChainUnderlying;
  }

  /// @notice Helper to get vault address of vaultNumber with given chainID
  function getVaultAddress(uint256 _vaultNumber, uint32 _chainId) internal view returns(address) {
    return vaults[_vaultNumber].vaultChainAddress[_chainId];
  }

  /// @notice Helper to get underyling address of vaultNumber with given chainID eg USDC
  function getUnderlyingAddress(uint256 _vaultNumber, uint32 _chainId) internal view returns(address) {
    return vaults[_vaultNumber].vaultUnderlyingAddress[_chainId];
  }

  /// @notice Helper to get current allocation per chain of vaultNumber with given chainID
  function getCurrentAllocation(uint256 _vaultNumber, uint32 _chainId) internal view returns(int256) {
    return vaults[_vaultNumber].currentAllocationPerChain[_chainId];
  }

  function getCurrentTotalAllocation(uint256 _vaultNumber) internal view returns(int256) {
    return vaults[_vaultNumber].totalCurrentAllocation;
  }

  /// @notice Set Vault address and underlying for a particulair chainId
  /// @param _vaultNumber number of Vault
  /// @param _chainId number of chainId
  /// @param _address address of the Vault
  /// @param _underlying underlying of the Vault eg USDC
  function setVaultChainAddress(
    uint256 _vaultNumber, 
    uint32 _chainId, 
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

  function setXProviderAddress(address _xProvider, uint32 _chainId) external onlyDao {
    xProviders[_chainId] = _xProvider;
  }

  /// @notice Setter for chainId array
  /// @param _chainIds array of all the used chainIds
  function setChainIdArray(uint32[] memory _chainIds) external onlyDao {
    chainIds = _chainIds;
  }
}