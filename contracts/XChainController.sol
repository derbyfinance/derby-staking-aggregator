// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IETFVault.sol";

import "hardhat/console.sol";

contract XChainController {

  struct ETFVaultXChain {
    address chain1;
    address chain2;
    address chain3;
  }

  uint256 public latestChainId = 3;
  int256 public marginScale = 1E10; // 10000 USDC

  // ETFNumber => deltaAllocation
  mapping(uint256 => int256) internal totalDeltaAllocationsETF;

  mapping(uint256 => int256) internal totalCurrentAllocationsETF;

  // ETFNumber => chainId => deltaAllocation
  mapping(uint256 => mapping(uint256 => int256)) internal deltaAllocationPerChainETF;

  // ETFNumber => chainId => currentAllocation
  mapping(uint256 => mapping(uint256 => int256)) internal currentAllocationPerChainETF;

  // ETFNumber => chainId => address
  mapping(uint256 => mapping(uint256 => address)) internal ETFVaultChainAddress;

  constructor() {
      
  }

  function rebalanceXChainAllocations(uint256 _ETFNumber) external {
    uint256 totalChainUnderlying = getTotalChainUnderlying(_ETFNumber);

    totalCurrentAllocationsETF[_ETFNumber] += totalDeltaAllocationsETF[_ETFNumber];
    totalDeltaAllocationsETF[_ETFNumber] = 0;

    for (uint i = 1; i <= latestChainId; i++) {
      setXChainAllocation(_ETFNumber, i);
      int256 currentAllocation = currentAllocationPerChainETF[_ETFNumber][i];
      int256 totalAllocation = totalCurrentAllocationsETF[_ETFNumber];

      int256 amountToChainVault = int(totalChainUnderlying) * currentAllocation / totalAllocation;

      if (amountToChainVault > marginScale) {
        
      } 
      console.log("amountToChain %s", uint(amountToChainVault));
    }
  }

  function setXChainAllocation(uint256 _ETFNumber, uint256 _chainId) internal {
    currentAllocationPerChainETF[_ETFNumber][_chainId] += deltaAllocationPerChainETF[_ETFNumber][_chainId];
    deltaAllocationPerChainETF[_ETFNumber][_chainId] = 0;
  }

  function getTotalChainUnderlying(uint256 _ETFNumber) public view returns(uint256 amount) {
    for (uint i = 1; i <= latestChainId; i++) {
      address vaultAddress = ETFVaultChainAddress[_ETFNumber][i];
      amount += IETFVault(vaultAddress).getTotalUnderlyingTEMP();
    }
  }

  function setTotalDeltaAllocations(uint256 _ETFNumber, int256 _allocation) external {
    totalDeltaAllocationsETF[_ETFNumber] += _allocation;
  }

  function setDeltaAllocationPerChain(uint256 _ETFNumber, uint256 _chainId, int256 _allocation) external {
    deltaAllocationPerChainETF[_ETFNumber][_chainId] += _allocation; 
  }

  function setETFVaultChainAddress(uint256 _ETFNumber, uint256 _chainId, address _address) external {
    ETFVaultChainAddress[_ETFNumber][_chainId] = _address; 
  }


}