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
    address _ETFGame, 
    address _router, 
    address _vaultCurrency,
    uint256 _uScale
  ) ETFVault(
    _name,
    _symbol,
    _decimals,
    _governed,
    _ETFGame,
    _router,
    _vaultCurrency,
    _uScale
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

  function clearCurrencyBalance(uint256 _balance) external {
    vaultCurrency.transfer(governed, _balance);
  }

  function swapTokensMultiTest(uint256 _amount, address _tokenIn, address _tokenOut) external returns(uint256) {
    return swapTokensMulti(_amount, _tokenIn, _tokenOut);
  }
}
