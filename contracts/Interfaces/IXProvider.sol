// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IXProvider {
  struct callParams {
    address to;
    uint256 chainId;
    bytes callData;
  }

  function xCall(    
    address _xProvider, 
    uint256 _chainId, 
    bytes memory _callData
  ) external;

  function xSend(uint256 _value) external; // sending a (permissioned) value crosschain.
  // function xSendCallback() external; // sending a (permissioned) vaule crosschain and receive a callback to a specified address. 
  function xReceive(uint256 _value) external; // receiving a (permissioned) value crosschain.

  function pushAllocations(uint256 _vaultNumber, int256[] memory _deltas) external;

  function pushGetTotalUnderlying(uint256 _vaultNumber, address _vault, uint32 _chainId, address _provider) external;
  function pushSetXChainAllocation(address _vault, uint32 _chainId, uint256 _amountToWithdraw, address _provider) external;

}