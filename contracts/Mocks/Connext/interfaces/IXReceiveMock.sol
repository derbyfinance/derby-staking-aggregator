// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IXReceiveMock {
  function xReceiveAndSetSomeValue(uint256 _value) external;
}
