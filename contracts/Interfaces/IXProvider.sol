// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IXProvider {
  struct callParams {
    address to;
    uint256 chainId;
    bytes callData;
  }

  function xTransfer() external;

  function xCall(    
    address _xProvider, 
    uint256 _chainId, 
    bytes memory _callData
  ) external;

  function pushAllocationsToController(uint256 _vaultNumber, int256[] memory _deltas) external;

}