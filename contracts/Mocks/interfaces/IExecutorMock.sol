// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IExecutorMock {
  /// Mock because the ExecutorArgs differ slightly
  struct ExecutorArgs {
    address to;
    bytes callData;
    address originSender; // not in original interface, for mocking only
    uint32 origin; // not in original interface, for mocking only
  }

  function originSender() external returns (address);
  function origin() external returns (uint32);
  function execute(ExecutorArgs calldata _args) external payable returns (bool success, bytes memory returnData);
}