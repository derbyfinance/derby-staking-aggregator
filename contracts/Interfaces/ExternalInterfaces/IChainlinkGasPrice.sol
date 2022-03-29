// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IChainlinkGasPrice {
  function latestAnswer() external returns(uint256);
}