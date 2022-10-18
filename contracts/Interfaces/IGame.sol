// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IGame {
  function Vaults(uint256 _ETFnumber) external view returns (address);

  function basketUnredeemedRewardsViaVault(uint256 _basketId, address _ownerAddr)
    external
    view
    returns (int256);

  function basketRedeemedRewards(uint256 _basketId) external view returns (int256);

  function setUnredeemedToRedeemed(uint256 _basketId, address _ownerAddr) external;

  function settleRewards(
    uint256 _vaultNumber,
    uint16 _chainId,
    int256[] memory rewards
  ) external;
}
