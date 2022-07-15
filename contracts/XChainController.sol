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

  struct vaultInfo {
    int256 totalDeltaAllocation;
    int256 totalCurrentAllocation;
    uint256 totalChainUnderlying;
    uint256 underlyingReceived;
    mapping(uint256 => int256) deltaAllocationPerChain; // chainId => allocation
    mapping(uint256 => int256) currentAllocationPerChain; // chainId => allocation
    mapping(uint256 => address) vaultChainAddress; // different for actual xChain
    mapping(uint256 => address) vaultUnderlyingAddress; // different for actual xChain
    mapping(uint256 => uint256) amountToDepositPerChain; // chainId => amountToDeposit
  }

  struct vaultStages {
    uint256 activeVaults;

    uint256 ready;
    uint256 allocationsReceived;
    uint256 underlyingReceived;
    uint256 fundsReceived;

  }

  mapping(uint256 => vaultInfo) internal vaults;

  

  modifier onlyGame {
    require(msg.sender == game, "XChainController: only Game");
    _;
  }

  modifier onlyDao {
    require(msg.sender == dao, "XChainController: only DAO");
    _;
  }

  constructor(address _game, address _dao) {
    // feedback vault state back to controller
    // transfers via provider
    game = _game;
    dao = _dao;
  }

  /// @notice Rebalances i.e deposit or withdraw all cross chains for a given vaultNumber
  /// @dev 
  /// @param _vaultNumber number of Vault
  function rebalanceXChainAllocations(uint256 _vaultNumber) external onlyDao {
    require(vaults[_vaultNumber].underlyingReceived == latestChainId, "Total underlying not set");
    // Correct state for Controller needed
    uint256 totalChainUnderlying = getTotalUnderlyingETF(_vaultNumber);
    int256 totalAllocation = setInternalAllocation(_vaultNumber);

    for (uint i = 1; i <= latestChainId; i++) {
      setXChainAllocation(_vaultNumber, i);
      address vaultAddress = getVaultAddress(_vaultNumber, i);

      int256 amountToChainVault = int(totalChainUnderlying) * getCurrentAllocation(_vaultNumber, i) / totalAllocation;

      (int256 amountToDeposit, uint256 amountToWithdraw) = calcDepositWithdraw(vaultAddress, amountToChainVault);

      if (amountToDeposit > 0) {
        vaults[_vaultNumber].amountToDepositPerChain[i] = uint256(amountToDeposit);
        IVault(vaultAddress).setAllocationXChain(0);
        // up state for vault
      }
      if (amountToWithdraw > 0) {
        IVault(vaultAddress).setAllocationXChain(amountToWithdraw);
      }
    }
  }

  /// @notice Helper function so the rebalance will execute all withdrawals first and can wait for vaults to deposit
  /// @dev Executes and resets all deposits set in mapping(amountToDepositPerChain) by rebalanceXChainAllocations
  /// @param _vaultNumber number of Vault
  function executeDeposits(uint256 _vaultNumber) external onlyDao {
    // Correct state for Controller needed
    for (uint i = 0; i <= latestChainId; i++) {
      uint256 amount = vaults[_vaultNumber].amountToDepositPerChain[i];
      if (amount == 0) continue;

      vaults[_vaultNumber].amountToDepositPerChain[i] = 0;
      IERC20(getUnderlyingAddress(_vaultNumber, i)).safeTransfer(getVaultAddress(_vaultNumber, i), amount);

      // TEMP
      IVault(getVaultAddress(_vaultNumber, i)).setVaultState(3);
    }
  }

  /// @notice Get total balance in vaultCurrency for an vaultNumber in all chains
  /// @param _vaultNumber number of Vault
  function setTotalChainUnderlying(uint256 _vaultNumber) public {
    vaults[_vaultNumber].totalChainUnderlying = 0;

    for (uint i = 1; i <= latestChainId; i++) {
      bytes4 selector = bytes4(keccak256("getTotalUnderlying(uint256,address)"));
      bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, getVaultAddress(_vaultNumber, i));

      xProvider.xCall(xProviderAddr, i, callData);
    }
  }
  
  function addTotalChainUnderlying(uint256 _vaultNumber, uint256 _amount) external {
    vaults[_vaultNumber].totalChainUnderlying += _amount;
    vaults[_vaultNumber].underlyingReceived ++;
  }

  function calcDepositWithdraw(address _vault, int256 _amountToChain) internal view returns(int256, uint256) {
    uint256 currentUnderlying = IVault(_vault).getTotalUnderlyingIncBalance();

    int256 amountToDeposit = _amountToChain - int256(currentUnderlying);
    uint256 amountToWithdraw = amountToDeposit < 0 ? currentUnderlying - uint256(_amountToChain) : 0;

    return (amountToDeposit, amountToWithdraw);
  }

  /// @notice Gets saved totalUnderlying for vaultNumber
  function getTotalUnderlyingETF(uint256 _vaultNumber) public view returns(uint256) {
    require(vaults[_vaultNumber].underlyingReceived == latestChainId, "Not all vaults set");
    return vaults[_vaultNumber].totalChainUnderlying;
  }

  /// @notice Helper to get vault address of vaultNumber with given chainID
  function getVaultAddress(uint256 _vaultNumber, uint256 _chainId) internal view returns(address) {
    return vaults[_vaultNumber].vaultChainAddress[_chainId];
  }

  /// @notice Helper to get underyling address of vaultNumber with given chainID eg USDC
  function getUnderlyingAddress(uint256 _vaultNumber, uint256 _chainId) internal view returns(address) {
    return vaults[_vaultNumber].vaultUnderlyingAddress[_chainId];
  }

  /// @notice Helper to get current allocation per chain of vaultNumber with given chainID
  function getCurrentAllocation(uint256 _vaultNumber, uint256 _chainId) internal view returns(int256) {
    return vaults[_vaultNumber].currentAllocationPerChain[_chainId];
  }

  /// @notice Helper to settle the total current allocation with the total delta allocation
  /// @param _vaultNumber number of Vault
  /// @return totalAllocation total current allocation for vaultNumber to be used in rebalance function
  function setInternalAllocation(uint256 _vaultNumber) internal returns(int256 totalAllocation) {
    vaults[_vaultNumber].totalCurrentAllocation += vaults[_vaultNumber].totalDeltaAllocation;
    vaults[_vaultNumber].totalDeltaAllocation = 0;

    totalAllocation = vaults[_vaultNumber].totalCurrentAllocation;
  }

  /// @notice Helper to add delta allocation to current allocation for particulair chainId
  /// @param _vaultNumber number of Vault
  /// @param _chainId number of chainId
  function setXChainAllocation(uint256 _vaultNumber, uint256 _chainId) internal {
    vaults[_vaultNumber].currentAllocationPerChain[_chainId] += vaults[_vaultNumber].deltaAllocationPerChain[_chainId];
    vaults[_vaultNumber].deltaAllocationPerChain[_chainId] = 0;
  }

  /// @notice Setter for Game contract to set Total delta allocation for Vault
  /// @param _vaultNumber number of Vault
  /// @param _allocation total delta allocation for Vault (all chainIds)
  function setTotalDeltaAllocations(uint256 _vaultNumber, int256 _allocation) external onlyGame {
    vaults[_vaultNumber].totalDeltaAllocation += _allocation;
  }

  /// @notice Setter for Game contract to set delta allocation for a particulair chainId
  /// @param _vaultNumber number of Vault
  /// @param _chainId number of chainId
  /// @param _allocation delta allocation
  function setDeltaAllocationPerChain(uint256 _vaultNumber, uint256 _chainId, int256 _allocation) external onlyGame {
    vaults[_vaultNumber].deltaAllocationPerChain[_chainId] += _allocation;
  }

  /// @notice Set Vault address and underlying for a particulair chainId
  /// @param _vaultNumber number of Vault
  /// @param _chainId number of chainId
  /// @param _address address of the Vault
  /// @param _underlying underlying of the Vault eg USDC
  function setVaultChainAddress(
    uint256 _vaultNumber, 
    uint256 _chainId, 
    address _address, 
    address _underlying
  ) external onlyDao{
    vaults[_vaultNumber].vaultChainAddress[_chainId] = _address; 
    vaults[_vaultNumber].vaultUnderlyingAddress[_chainId] = _underlying;
  }

  // OnlyDao
  function setProviderAddress(address _xProvider) external {
    xProvider = IXProvider(_xProvider);
    xProviderAddr = _xProvider;
  }
}