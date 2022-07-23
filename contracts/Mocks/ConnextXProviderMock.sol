// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./interfaces/IXProviderMock.sol";
import "./interfaces/IXReceiveMock.sol";
import "../Interfaces/ExternalInterfaces/IConnextHandler.sol";
import "./interfaces/IExecutorMock.sol";
import {XCallArgs, CallParams} from "../libraries/LibConnextStorage.sol";

import "hardhat/console.sol";

contract ConnextXProviderMock is IXProviderMock {
  /// Specific implementation of a XProvider for the Connext network
  /// Mocking solution for local testing
  /// This specific implementation can be changed to the real one and be tested still in this setup
  /// The ONLY thing that needs to be changed in local testing is the recovery parameter which should in local testing be set to msg.sender
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
    require(IExecutorMock(msg.sender).originSender() == xSendMock && 
    IExecutorMock(msg.sender).origin() == xSendMockChainID && 
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

  /// @notice setter for the sender contract parameters, always needs to be set, could be a list when multiple contracts on the sending chain have to send values.
  /// @param _xSendMock address of sending contract, e.g. game contract to send totalAllocations to xChainController
  /// @param _xSendMockChainID chain id of sending contract, e.g. optimism, where the game lives
  function setXSendMock(address _xSendMock, uint32 _xSendMockChainID) external onlyDao {
    xSendMock = _xSendMock;
    xSendMockChainID = _xSendMockChainID;
  }

  /// @notice setter for the receiver contract parameters, always needs to be set, could be a list when multiple contracts on the sending chain have to send values.
  /// @param _xReceiveMock address of receiving contract, e.g. xChainController contract to send game totalAllocations to xChainController
  /// @param _xReceiveMockChainID chain id of receiving contract, e.g. ethereum, where the xChainController lives
  function setxReceiveMock(address _xReceiveMock, uint32 _xReceiveMockChainID) external onlyDao {
    xReceiveMock = _xReceiveMock;
    xReceiveMockChainID = _xReceiveMockChainID;
  }

  /// @notice setter for the address of the xprovider on the receiving chain, only needs to be set on sender xprovider
  /// @param _receiveProviderAddress address of the xprovider on the receiving chain
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
      recovery: msg.sender, // misused here for mocking purposes --> in this context it is the originSender contract used for the onlyExecutor modifier      
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

  /// @notice Function to receive value crosschain, onlyExecutor modifier makes sure only xSend can actually send the value
  /// @param _value Value to send crosschain.
  function xReceive(uint256 _value) external  onlyExecutor {
    IXReceiveMock(xReceiveMock).xReceiveAndSetSomeValue(_value);
  }
}