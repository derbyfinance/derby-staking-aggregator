// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "hardhat/console.sol";

contract XChainController {

  struct ETFVaultXChain {
    address chain1;
    address chain2;
    address chain3;
  }

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

  function rebalanceXChain() external {

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