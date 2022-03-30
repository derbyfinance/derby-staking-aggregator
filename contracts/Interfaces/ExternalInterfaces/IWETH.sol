// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IWETH {
  function withdraw(address _guy, uint256 _amount) external;
  function approve(address _guy, uint256 _amount) external;
}