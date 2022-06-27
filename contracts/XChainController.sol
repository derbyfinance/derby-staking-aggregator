// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IETFVault.sol";
import "./Interfaces/IXProvider.sol";

import "hardhat/console.sol";

contract XChainController {
  using SafeERC20 for IERC20;

  uint256 public latestChainId = 3; // will adjust at xchain implementation
  address public game;
  address public dao;
  address public xProviderAddr;
  IXProvider public xProvider;

  struct ETFinfo {
    int256 totalDeltaAllocation;
    int256 totalCurrentAllocation;
    mapping(uint256 => int256) deltaAllocationPerChain; // chainId => allocation
    mapping(uint256 => int256) currentAllocationPerChain; // chainId => allocation
    mapping(uint256 => address) vaultChainAddress; // different for actual xChain
    mapping(uint256 => address) vaultUnderlyingAddress; // different for actual xChain
    mapping(uint256 => uint256) amountToDepositPerChain; // chainId => amountToDeposit
  }

  mapping(uint256 => ETFinfo) internal ETFs;

  modifier onlyGame {
    require(msg.sender == game, "XChainController: only Game");
    _;
  }

  modifier onlyDao {
    require(msg.sender == dao, "XChainController: only DAO");
    _;
  }

  constructor(address _game, address _dao, address _xProvider) {
    // feedback vault state back to controller
    // transfers via provider
    game = _game;
    dao = _dao;
    xProvider = IXProvider(_xProvider);
    xProviderAddr = _xProvider;
  }

  /// @notice Rebalances i.e deposit or withdraw all cross chains for a given ETFNumber
  /// @dev 
  /// @param _ETFNumber number of ETFVault
  function rebalanceXChainAllocations(uint256 _ETFNumber) external onlyDao {
    // Correct state for Controller needed
    uint256 totalChainUnderlying = setTotalChainUnderlying(_ETFNumber);
    int256 totalAllocation = setInternalAllocation(_ETFNumber);

    for (uint i = 1; i <= latestChainId; i++) {
      setXChainAllocation(_ETFNumber, i);
      address vaultAddress = getVaultAddress(_ETFNumber, i);

      int256 amountToChainVault = int(totalChainUnderlying) * getCurrentAllocation(_ETFNumber, i) / totalAllocation;

      uint256 currentUnderlying = IETFVault(vaultAddress).getTotalUnderlyingTEMP();

      int256 amountToDeposit = amountToChainVault - int256(currentUnderlying);
      uint256 amountToWithdraw = amountToDeposit < 0 ? currentUnderlying - uint256(amountToChainVault) : 0;

      if (amountToDeposit > 0) {
        ETFs[_ETFNumber].amountToDepositPerChain[i] = uint256(amountToDeposit);
        IETFVault(vaultAddress).setAllocationXChain(0);
        // up state for vault
      }
      if (amountToWithdraw > 0) {
        IETFVault(vaultAddress).setAllocationXChain(amountToWithdraw);
      }
    }
  }

  /// @notice Helper function so the rebalance will execute all withdrawals first and can wait for vaults to deposit
  /// @dev Executes and resets all deposits set in mapping(amountToDepositPerChain) by rebalanceXChainAllocations
  /// @param _ETFNumber number of ETFVault
  function executeDeposits(uint256 _ETFNumber) external onlyDao {
    // Correct state for Controller needed
    for (uint i = 0; i <= latestChainId; i++) {
      uint256 amount = ETFs[_ETFNumber].amountToDepositPerChain[i];
      if (amount == 0) continue;

      ETFs[_ETFNumber].amountToDepositPerChain[i] = 0;
      IERC20(getUnderlyingAddress(_ETFNumber, i)).safeTransfer(getVaultAddress(_ETFNumber, i), amount);

      // TEMP
      IETFVault(getVaultAddress(_ETFNumber, i)).setVaultState(3);
    }
  }

  /// @notice Get total balance in vaultCurrency for an ETFNumber in all chains
  /// @param _ETFNumber number of ETFVault
  /// @return balance Total balance in VaultCurrency e.g USDC
  function setTotalChainUnderlying(uint256 _ETFNumber) public returns(uint256 balance) {
    for (uint i = 1; i <= latestChainId; i++) {
      bytes4 selector = bytes4(keccak256("getTotalUnderlying(address)"));
      bytes memory callData = abi.encodeWithSelector(selector, getVaultAddress(_ETFNumber, i));

      IXProvider.callParams memory callParams = IXProvider.callParams({
        to: xProviderAddr,
        chainId: i,
        callData: callData
      });
      
      xProvider.xCall(callParams);
    }
  }

  /// @notice Helper to get vault address of ETFNumber with given chainID
  function getVaultAddress(uint256 _ETFNumber, uint256 _chainId) internal view returns(address) {
    return ETFs[_ETFNumber].vaultChainAddress[_chainId];
  }

  /// @notice Helper to get underyling address of ETFNumber with given chainID eg USDC
  function getUnderlyingAddress(uint256 _ETFNumber, uint256 _chainId) internal view returns(address) {
    return ETFs[_ETFNumber].vaultUnderlyingAddress[_chainId];
  }

  /// @notice Helper to get current allocation per chain of ETFNumber with given chainID
  function getCurrentAllocation(uint256 _ETFNumber, uint256 _chainId) internal view returns(int256) {
    return ETFs[_ETFNumber].currentAllocationPerChain[_chainId];
  }

  /// @notice Helper to settle the total current allocation with the total delta allocation
  /// @param _ETFNumber number of ETFVault
  /// @return totalAllocation total current allocation for ETFNumber to be used in rebalance function
  function setInternalAllocation(uint256 _ETFNumber) internal returns(int256 totalAllocation) {
    ETFs[_ETFNumber].totalCurrentAllocation += ETFs[_ETFNumber].totalDeltaAllocation;
    ETFs[_ETFNumber].totalDeltaAllocation = 0;

    totalAllocation = ETFs[_ETFNumber].totalCurrentAllocation;
  }

  /// @notice Helper to add delta allocation to current allocation for particulair chainId
  /// @param _ETFNumber number of ETFVault
  /// @param _chainId number of chainId
  function setXChainAllocation(uint256 _ETFNumber, uint256 _chainId) internal {
    ETFs[_ETFNumber].currentAllocationPerChain[_chainId] += ETFs[_ETFNumber].deltaAllocationPerChain[_chainId];
    ETFs[_ETFNumber].deltaAllocationPerChain[_chainId] = 0;
  }

  /// @notice Setter for Game contract to set Total delta allocation for ETFVault
  /// @param _ETFNumber number of ETFVault
  /// @param _allocation total delta allocation for ETFVault (all chainIds)
  function setTotalDeltaAllocations(uint256 _ETFNumber, int256 _allocation) external onlyGame {
    ETFs[_ETFNumber].totalDeltaAllocation += _allocation;
  }

  /// @notice Setter for Game contract to set delta allocation for a particulair chainId
  /// @param _ETFNumber number of ETFVault
  /// @param _chainId number of chainId
  /// @param _allocation delta allocation
  function setDeltaAllocationPerChain(uint256 _ETFNumber, uint256 _chainId, int256 _allocation) external onlyGame {
    ETFs[_ETFNumber].deltaAllocationPerChain[_chainId] += _allocation;
  }

  /// @notice Set ETFVault address and underlying for a particulair chainId
  /// @param _ETFNumber number of ETFVault
  /// @param _chainId number of chainId
  /// @param _address address of the ETFVault
  /// @param _underlying underlying of the ETFVault eg USDC
  function setETFVaultChainAddress(
    uint256 _ETFNumber, 
    uint256 _chainId, 
    address _address, 
    address _underlying
  ) external onlyDao{
    ETFs[_ETFNumber].vaultChainAddress[_chainId] = _address; 
    ETFs[_ETFNumber].vaultUnderlyingAddress[_chainId] = _underlying;
  }
}