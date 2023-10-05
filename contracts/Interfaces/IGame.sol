// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

interface IGame {
  function settleRewards(uint256 _vaultNumber, uint32 _chainId, int256[] memory rewards) external;
}
