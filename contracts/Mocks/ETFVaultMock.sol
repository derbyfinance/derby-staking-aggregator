// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../ETFVault.sol";
import "hardhat/console.sol";

contract ETFVaultMock is ETFVault { // is VaultToken

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    address _governed, 
    uint256 _ETFnumber, 
    address _router, 
    address _vaultCurrency, 
    uint256 _threshold
  ) ETFVault(
    _name,
    _symbol,
    _decimals,
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

  function setCurrentAllocation(uint256 _protocolNum, int256 _allocation) external {
    currentAllocations[_protocolNum] = _allocation;
  }

  function clearCurrencyBalance() external {
    uint256 balance = vaultCurrency.balanceOf(address(this));
    vaultCurrency.transfer(governed, balance);
  }
}