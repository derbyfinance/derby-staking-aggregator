// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IVault.sol";
import "./Interfaces/IXProvider.sol";
import "./Interfaces/IXChainController.sol";
import "./Mocks/interfaces/IExecutorMock.sol";
import "./Interfaces/ExternalInterfaces/IConnextHandler.sol";
import {XCallArgs, CallParams} from "./libraries/LibConnextStorage.sol";

import "hardhat/console.sol";

contract XProvider {
  IConnextHandler public immutable connext;
  address public xController;
  address public xControllerProvider;
  address public receiveProvider;
  address public dao;
  address public executor;

  uint32 public homeChainId;
  uint32 public xControllerChain;

  modifier onlyDao {
    require(msg.sender == dao, "ConnextProvider: only DAO");
    _;
  }

  // modifier onlyExecutor() { 
  //   require(IExecutorMock(msg.sender).originSender() == xSendMock && 
  //   IExecutorMock(msg.sender).origin() == xSendMockChainID && 
  //   msg.sender == executor, 
  //   "Expected origin contract on origin domain called by Executor"); 
  //   _;  
  // }
  
  // constructor(address _xController) {
  //   xController = _xController;
  // }

  constructor(
    address _executor,
    address _connextHandler,
    address _dao,
    address _xController,
    uint32 _homeChainId
  ){
    executor = _executor;
    xController = _xController;
    dao = _dao;
    connext = IConnextHandler(_connextHandler);
    homeChainId = _homeChainId;
  }

  function xCall(
    address _xProvider, 
    uint256 _chainId, 
    bytes memory _callData
  ) public {
    IXProvider.callParams memory params = IXProvider.callParams({
      to: _xProvider,
      chainId: _chainId,
      callData: _callData
    });

    (bool success,) = params.to.call(params.callData);
    require(success, "No success");
  }

  /// @notice Function to send an integer value crosschain
  // / @param _callData Value to send crosschain.
  function xSend(
    address _to,
    uint32 _originDomain,
    uint32 _destinationDomain,
    bytes memory _callData
  ) internal {
    CallParams memory callParams = CallParams({
      to: _to,
      callData: _callData,
      originDomain: _originDomain,
      destinationDomain: _destinationDomain,
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

  function pushAllocations(uint256 _vaultNumber, int256[] memory _deltas) public {
    bytes4 selector = bytes4(keccak256("receiveAllocations(uint256,int256[])"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _deltas);

    xSend(xControllerProvider, homeChainId, xControllerChain, callData);
  }

  function receiveAllocations(uint256 _vaultNumber, int256[] memory _deltas) external {
    return IXChainController(xController).receiveAllocationsFromGame(_vaultNumber, _deltas);
  }

  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }

  /// @notice Setter for xControllerProvider address
  /// @param _xControllerProvider new address of xProvider for xController chain
  function setXControllerProvider(address _xControllerProvider) external onlyDao {
    xControllerProvider = _xControllerProvider;
  }

  /// @notice Setter for xControllerProvider address
  /// @param _xControllerChain new address of xProvider for xController chain
  function setXControllerChainId(uint32 _xControllerChain) external onlyDao {
    xControllerChain = _xControllerChain;
  }

  // function getTotalUnderlying(uint256 _vaultNumber, address _vault) public {
  //   uint256 underlying = IVault(_vault).getTotalUnderlyingIncBalance();

  //   bytes4 selector = bytes4(keccak256("setTotalUnderlying(uint256,uint256)"));
  //   bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, underlying);

  //   // callback
  //   xCall(address(this), 0, callData);
  // }
  
  // function setTotalUnderlying(uint256 _vaultNumber, uint256 _underlying) public {
  //   IXChainController(xController).addTotalChainUnderlying(_vaultNumber, _underlying);
  // }

}