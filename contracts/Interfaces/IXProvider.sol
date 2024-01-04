// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

interface IXProvider {
  function xReceive(uint256 _value) external; // receiving a (permissioned) value crosschain.

  function pushProtocolAllocationsToVault(
    uint32 _chainId,
    address _vault,
    int256[] memory _deltas
  ) external payable;

  function pushRewardsToVault(
    uint32 _chainId,
    address _vault,
    address _user,
    uint256 _value
  ) external payable;

  function pushRewardsToGame(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) external payable;
}
