// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IETFVault.sol";

import "hardhat/console.sol";

contract XChainController {
  using SafeERC20 for IERC20;

  uint256 public latestChainId = 3;
  // int256 public marginScale = 1E10; // 10000 USDC

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

  constructor() {
  }

  function rebalanceXChainAllocations(uint256 _ETFNumber) external {
    uint256 totalChainUnderlying = getTotalChainUnderlying(_ETFNumber);

    int256 totalAllocation = setInternalAllocation(_ETFNumber);

    for (uint i = 1; i <= latestChainId; i++) {
      setXChainAllocation(_ETFNumber, i);

      address vaultAddress = ETFs[_ETFNumber].vaultChainAddress[i];
      int256 currentAllocation = ETFs[_ETFNumber].currentAllocationPerChain[i];

      int256 amountToChainVault = int(totalChainUnderlying) * currentAllocation / totalAllocation;
      console.log("amountToChain %s", uint(amountToChainVault));

      uint256 currentUnderlying = IETFVault(vaultAddress).getTotalUnderlyingTEMP();

      int256 amountToDeposit = amountToChainVault - int256(currentUnderlying);
      uint256 amountToWithdraw = amountToDeposit < 0 ? currentUnderlying - uint256(amountToChainVault) : 0;

      if (amountToDeposit > 0) {
        ETFs[_ETFNumber].amountToDepositPerChain[i] = uint256(amountToDeposit);
        IETFVault(vaultAddress).setAllocationXChain(0);
      }
      if (amountToWithdraw > 0) {
        IETFVault(vaultAddress).setAllocationXChain(amountToWithdraw);
      }
    }
  }

  function executeDeposits(uint256 _ETFNumber) external {
    for (uint i = 0; i <= latestChainId; i++) {
      uint256 amount = ETFs[_ETFNumber].amountToDepositPerChain[i];
      if (amount == 0) continue;

      address vaultAddress = ETFs[_ETFNumber].vaultChainAddress[i];
      address underlyingAddress = ETFs[_ETFNumber].vaultUnderlyingAddress[i];

      ETFs[_ETFNumber].amountToDepositPerChain[i] = 0;
      IERC20(underlyingAddress).safeTransfer(vaultAddress, amount);
    }
  }

  function setInternalAllocation(uint256 _ETFNumber) internal returns (int256 totalAllocation) {
    ETFs[_ETFNumber].totalCurrentAllocation += ETFs[_ETFNumber].totalDeltaAllocation;
    ETFs[_ETFNumber].totalDeltaAllocation = 0;

    totalAllocation = ETFs[_ETFNumber].totalCurrentAllocation;
  }

  function setXChainAllocation(uint256 _ETFNumber, uint256 _chainId) internal {
    ETFs[_ETFNumber].currentAllocationPerChain[_chainId] += ETFs[_ETFNumber].deltaAllocationPerChain[_chainId];
    ETFs[_ETFNumber].deltaAllocationPerChain[_chainId] = 0;
  }

  function getTotalChainUnderlying(uint256 _ETFNumber) public view returns(uint256 amount) {
    for (uint i = 1; i <= latestChainId; i++) {
      address vaultAddress = ETFs[_ETFNumber].vaultChainAddress[i];
      amount += IETFVault(vaultAddress).getTotalUnderlyingTEMP();
    }
  }

  function setTotalDeltaAllocations(uint256 _ETFNumber, int256 _allocation) external {
    ETFs[_ETFNumber].totalDeltaAllocation += _allocation;
  }

  function setDeltaAllocationPerChain(uint256 _ETFNumber, uint256 _chainId, int256 _allocation) external {
    ETFs[_ETFNumber].deltaAllocationPerChain[_chainId] += _allocation;
  }

  function setETFVaultChainAddress(
    uint256 _ETFNumber, 
    uint256 _chainId, 
    address _address, 
    address _underlying
  ) external {
    ETFs[_ETFNumber].vaultChainAddress[_chainId] = _address; 
    ETFs[_ETFNumber].vaultUnderlyingAddress[_chainId] = _underlying;
  }


}