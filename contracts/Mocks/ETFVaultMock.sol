// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "../ETFVault.sol";
import "hardhat/console.sol";

contract ETFVaultMock is ETFVault { // is VaultToken

  constructor(
    address _governed, 
    uint256 _ETFnumber, 
    address _router, 
    address _vaultCurrency, 
    uint256 _threshold
  ) ETFVault(
    _governed,
    _ETFnumber,
    _router,
    _vaultCurrency,
    _threshold
  ) {}

  function getAllocationTEST(uint256 _protocolNum) external view returns(int256) {
    return currentAllocations[_protocolNum];
  }

  function getDeltaAllocationTEST(uint256 _protocolNum) external view returns(int256) {
    return deltaAllocations[_protocolNum];
  }
}
