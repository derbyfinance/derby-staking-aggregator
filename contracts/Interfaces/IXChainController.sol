// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IXChainController {
  function addTotalChainUnderlying(uint256 _ETFNumber, uint256 _amount) external;
  function receiveAllocationsFromGame(uint256 _vaultNumber, int256[] memory _deltas) external;
}