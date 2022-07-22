// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./IXProviderMock.sol";
import "./IXReceiveMock.sol";
import "../Interfaces/ExternalInterfaces/IConnextHandler.sol";
import "../Interfaces/ExternalInterfaces/IExecutor.sol";
import {XCallArgs, CallParams} from "../libraries/LibConnextStorage.sol";

import "hardhat/console.sol";

contract ConnextXProviderMock is IXProviderMock {
  address xSendMock;
  uint32 xSendMockChainID;
  address xReceiveMock;
  uint32 xReceiveMockChainID;
  address receiveProvider;
  address dao;
  address executor;
  IConnextHandler public immutable connext;

  modifier onlyDao {
      require(msg.sender == dao, "ConnextProvider: only DAO");
      _;
  }

  modifier onlyExecutor() { 
    require(IExecutor(msg.sender).originSender() == xSendMock && 
    IExecutor(msg.sender).origin() == xSendMockChainID && 
    msg.sender == executor, 
    "Expected origin contract on origin domain called by Executor"); 
    _;  
  }
  
  constructor(
    address _executor,
    address _dao,
    address _connextHandler
  ){
    executor = _executor;
    dao = _dao;
    connext = IConnextHandler(_connextHandler);
  }

  function setXSendMock(address _xSendMock, uint32 _xSendMockChainID) external onlyDao {
    xSendMock = _xSendMock;
    xSendMockChainID = _xSendMockChainID;
  }

  function setxReceiveMock(address _xReceiveMock, uint32 _xReceiveMockChainID) external onlyDao {
    xReceiveMock = _xReceiveMock;
    xReceiveMockChainID = _xReceiveMockChainID;
  }

  function setReceiveProvider(address _receiveProviderAddress) external onlyDao {
    receiveProvider = _receiveProviderAddress;
  }

  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }

  /// @notice Function to send an integer value crosschain
  /// @param _value Value to send crosschain.
  function xSend(
    uint256 _value
  ) external {
    bytes4 selector = bytes4(keccak256("xReceive(uint256)"));    
    bytes memory callData = abi.encodeWithSelector(selector, _value);
    CallParams memory callParams = CallParams({
      to: receiveProvider,      
      callData: callData,      
      originDomain: xSendMockChainID,      
      destinationDomain: xReceiveMockChainID,      
      agent: receiveProvider,      
      recovery: receiveProvider,      
      forceSlow: true,      
      receiveLocal: false,      
      callback: address(0),      
      callbackFee: 0,      
      relayerFee: 0,      
      slippageTol: 9995    
    });

    XCallArgs memory xcallArgs = XCallArgs({
      params: callParams,      
      transactingAssetId: address(0), // The asset the caller sent with the transfer.
      amount: 0    
    });    
    connext.xcall(xcallArgs);
  }

  // onlyExecutor
  function xReceive(uint256 _value) external  {
    IXReceiveMock(xReceiveMock).xReceiveAndSetSomeValue(_value);
  }
}