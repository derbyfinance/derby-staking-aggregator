// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

interface IXProvider {
  function xCall(address _xProvider, uint16 _chainId, bytes memory _callData) external;

  function xSend(uint256 _value) external; // sending a (permissioned) value crosschain.

  // function xSendCallback() external; // sending a (permissioned) vaule crosschain and receive a callback to a specified address.
  function xReceive(uint256 _value) external; // receiving a (permissioned) value crosschain.

  function pushAllocations(uint256 _vaultNumber, int256[] memory _deltas) external;

  function receiveTotalUnderlying(
    uint256 _vaultNumber,
    uint16 _chainId,
    uint256 _underlying
  ) external;

  function pushSetXChainAllocation(
    address _vault,
    uint16 _chainId,
    uint256 _amountToWithdraw,
    uint256 _exchangeRate
  ) external;

  function xTransferToController(
    uint256 _vaultNumber,
    uint256 _amount,
    address _asset
  ) external payable;

  function receiveFeedbackToXController(uint256 _vaultNumber) external;

  function xTransferToVaults(
    address _vault,
    uint16 _chainId,
    uint256 _amount,
    address _asset
  ) external payable;

  function pushProtocolAllocationsToVault(
    uint16 _chainId,
    address _vault,
    int256[] memory _deltas
  ) external;

  function getDecimals(address _vault) external view returns (uint256);

  function pushTotalUnderlying(
    uint256 _vaultNumber,
    uint16 _chainId,
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  ) external;

  function pushStateFeedbackToVault(address _vault, uint16 _chainId, bool _state) external;

  function pushRewardsToGame(
    uint256 _vaultNumber,
    uint16 _chainId,
    int256[] memory _rewards
  ) external;

  function homeChain() external returns (uint16);
}
