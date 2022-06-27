// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IXProvider {
  struct callParams {
    address to;
    uint256 chainId;
    bytes callData;
  }

  function xTransfer() external;
  function xCall(callParams memory callParams) external;
  function xReceive(uint256) external;
}