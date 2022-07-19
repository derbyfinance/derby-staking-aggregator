// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IXProvider {
  // struct callParams {
  //   address to;
  //   uint256 chainId;
  //   bytes callData;
  // }

  // function xTransfer() external;

  // function xCall(    
  //   address _xProvider, 
  //   uint256 _chainId, 
  //   bytes memory _callData
  // ) external;

  function xSend(
    bool _permissioned, 
    uint256 _value, 
    string calldata _functionName, 
    address _address, 
    uint256 _chainID
  ) external; // sending a (permissioned) value crosschain.
  function xSendCallback() external; // sending a (permissioned) vaule crosschain and receive a callback to a specified address. 
  function xReceive(
    
  ) external; // receiving a (permissioned) value crosschain.
  function xReceiveCallback() external; // receiving a (permissioned) value crosschain where a callback was expected.
  function xTransferFunds() external; // transfer funds crosschain.
  function xReceiveFunds() external; // receive funds crosschain, maybe unnecessary.
  function setXController() external;
  function setGame() external;
}