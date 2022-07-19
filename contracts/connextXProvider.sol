// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IVault.sol";
import "./Interfaces/IXProvider.sol";
import "./Interfaces/IXChainController.sol";
import "./Interfaces/ExternalInterfaces/IConnextHandler.sol";
import {XCallArgs, CallParams} from "./libraries/LibConnextStorage.sol";

import "hardhat/console.sol";

contract ConnextXProvider is IXProvider {
  address xController;
  uint256 xControllerChainID;
  address game;
  uint256 gameChainID;
  address dao;
  IConnextHandler public immutable connext;
  
  constructor(
    address _xController, 
    uint256 _xControllerChainID, 
    address _game, 
    uint256 _gameChainID, 
    address _dao,
    address _connext
  ){
    xController = _xController;
    xControllerChainID = _xControllerChainID;
    game = _game;
    gameChainID = _gameChainID;
    dao = _dao;
    connext = IConnextHandler(_connext);
  }

  modifier onlyDao {
      require(msg.sender == dao, "ConnextProvider: only DAO");
      _;
  }

  function setXController(address _xController, uint256 _xControllerChainID) external onlyDao {
    xController = _xController;
    xControllerChainID = _xControllerChainID;
  }

  function setGame(address _game, uint256 _gameChainID) external onlyDao {
    game = _game;
    gameChainID = _gameChainID;
  }

  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }

  /// @notice Function to send an integer value crosschain
  /// @param _permissioned If true, will take slow liquidity path even if it is not a permissioned call
  /// @param _value Value to send crosschain.
  /// @param _functionName Name of the function that should ultimately be triggered by the xReceive function.
  /// @param _address Address of the contract that should ultimately be triggered by the xReceive function.
  /// @param _chainID The final domain (i.e. where `execute` / `reconcile` are called). Must match nomad domain schema (https://github.com/connext/chaindata/blob/main/crossChain.json#)
  function xSend(
    bool _permissioned, 
    uint256 _value, 
    string calldata _functionName, 
    address _address, 
    uint256 _chainID
  ) external {
    uint32 originChainID = 1111; // chainID of the chain this provider contract has been deployed on. 
                                // Must match nomad domain schema, 1111 for rinkeby (https://github.com/connext/chaindata/blob/main/crossChain.json#)
    bytes4 selector = bytes4(keccak256("xReceive(uint256,string)"));    
    bytes memory callData = abi.encodeWithSelector(selector, _value, _functionName);
    CallParams memory callParams = CallParams({
      to: _address,      
      callData: callData,      
      originDomain: originChainID,      
      destinationDomain: uint32(_chainID),      
      agent: _address,      
      recovery: _address,      
      forceSlow: _permissioned,      
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

  // function xTransfer() external {

  // }

  // function xCall(
  //   address _xProvider, 
  //   uint256 _chainId, 
  //   bytes memory _callData
  // ) public {
  //   IXProvider.callParams memory params = IXProvider.callParams({
  //     to: _xProvider,
  //     chainId: _chainId,
  //     callData: _callData
  //   });

  //   (bool success,) = params.to.call(params.callData);
  //   require(success, "No success");
  // }

  // function getTotalUnderlying(uint256 _ETFNumber, address _vault) public {
  //   uint256 underlying = IVault(_vault).getTotalUnderlyingIncBalance();

  //   bytes4 selector = bytes4(keccak256("setTotalUnderlying(uint256,uint256)"));
  //   bytes memory callData = abi.encodeWithSelector(selector, _ETFNumber, underlying);

  //   // callback
  //   xCall(address(this), 0, callData);
  // }
  
  // function setTotalUnderlying(uint256 _ETFNumber, uint256 _underlying) public {
  //   IXChainController(xController).addTotalChainUnderlying(_ETFNumber, _underlying);
  // }

  // function createCallParams(
  //   address _xProvider, 
  //   uint256 _chainId, 
  //   bytes memory _callData
  // ) internal returns (IXProvider.callParams memory params) {
  //   params = IXProvider.callParams({
  //     to: _xProvider,
  //     chainId: _chainId,
  //     callData: _callData
  //   });
  // }

}