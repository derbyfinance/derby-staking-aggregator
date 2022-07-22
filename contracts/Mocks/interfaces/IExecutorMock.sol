// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IExecutorMock {
  struct ExecutorArgs {
    address to;
    bytes callData;
    address originSender;
    uint32 origin;
  }

  function originSender() external returns (address);
  function origin() external returns (uint32);
  function execute(ExecutorArgs calldata _args) external payable returns (bool success, bytes memory returnData);
}