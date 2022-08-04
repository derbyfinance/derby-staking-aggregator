// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IXChainController {
  function addTotalChainUnderlying(uint256 _vaultNumber, uint256 _amount) external;
  function setTotalUnderlyingCallback(uint256 _vaultNumber, uint16 _chainId, uint256 _underlying) external;
  function receiveAllocationsFromGame(uint256 _vaultNumber, int256[] memory _deltas) external;
}