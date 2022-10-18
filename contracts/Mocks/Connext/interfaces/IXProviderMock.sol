// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IXProviderMock {
  // interface should be standard, we'll get a diffrent implementation per cross chain technology provider
  // the function signatures below should be changed in the different core functionalities we would like to implement cross chain
  // E.g. getTotalunderlying
  function xSend(uint256 _value) external; // sending a (permissioned) value crosschain.

  // function xSendCallback() external; // sending a (permissioned) vaule crosschain and receive a callback to a specified address.
  function xReceive(uint256 _value) external; // receiving a (permissioned) value crosschain.

  // function xReceiveCallback() external; // receiving a (permissioned) value crosschain where a callback was expected.
  function xTransfer(
    address to,
    address asset,
    uint32 originDomain,
    uint32 destinationDomain,
    uint256 amount
  ) external; // transfer funds crosschain.
  // function xReceiveFunds() external; // receive funds crosschain, maybe unnecessary.
  // function setXController() external;
  // function setGame() external;
}
