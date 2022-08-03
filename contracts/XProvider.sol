// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IVault.sol";
import "./Interfaces/IXProvider.sol";
import "./Interfaces/IXChainController.sol";
import "./Mocks/Connext/interfaces/IExecutorMock.sol";
import "./Interfaces/ExternalInterfaces/IConnextHandler.sol";
import {XCallArgs, CallParams} from "./libraries/LibConnextStorage.sol";

import "hardhat/console.sol";

contract XProvider {
  IConnextHandler public immutable connext;
  address public xController;
  address public xControllerProvider;
  address public receiveProvider;
  address public dao;
  address public game;
  address public executor;

  uint32 public homeChainId;
  uint32 public xControllerChain;
  uint32 public gameChain;

  mapping(address => bool) internal senderWhitelist;

  modifier onlyDao {
    require(msg.sender == dao, "ConnextProvider: only DAO");
    _;
  }

  modifier onlyController {
    require(msg.sender == xController, "ConnextProvider: only DAO");
    _;
  }

  modifier onlyGame {
    require(msg.sender == game, "ConnextProvider: only Game");
    _;
  }


  modifier onlyExecutor(uint32 _chain) { 
    require(
      senderWhitelist[IExecutorMock(msg.sender).originSender()] &&
      IExecutorMock(msg.sender).origin() == _chain &&
      msg.sender == executor,
      "!Executor"
    ); 
    _;  
  }
  
  constructor(
    address _executor,
    address _connextHandler,
    address _dao,
    address _game,
    address _xController,
    uint32 _homeChainId
  ){
    executor = _executor;
    dao = _dao;
    game = _game;
    xController = _xController;
    connext = IConnextHandler(_connextHandler);
    homeChainId = _homeChainId;
  }

  /// @notice Function to send an integer value crosschain
  /// @param _to address of the contract on receiving chain
  /// @param _originDomain Chain Id of sender chain
  /// @param _destinationDomain chain Id of destination chain
  /// @param _callData Function selector to call on receiving chain with params
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

  /// @notice Pushes the delta allocations from the game to the xChainController
  /// @param _vaultNumber number of the vault
  /// @param _deltas Array with delta Allocations for all chainIds
  function pushAllocations(uint256 _vaultNumber, int256[] memory _deltas) external onlyGame {
    bytes4 selector = bytes4(keccak256("receiveAllocations(uint256,int256[])"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _deltas);

    xSend(xControllerProvider, homeChainId, xControllerChain, callData);
  }

  /// @notice Receives the delta allocations from the game and routes to xChainController
  /// @param _vaultNumber number of the vault
  /// @param _deltas Array with delta Allocations for all chainIds
  function receiveAllocations(uint256 _vaultNumber, int256[] memory _deltas) external onlyExecutor(gameChain) {
    return IXChainController(xController).receiveAllocationsFromGame(_vaultNumber, _deltas);
  }

  /// @notice Pushes cross chain requests for the totalUnderlying for a vaultNumber on a chainId
  /// @param _vaultNumber number of the vault
  /// @param _vault Address of the Derby Vault on given chainId
  /// @param _chainId Number of chain used
  /// @param _provider Address of the provider on given chainId 
  function pushGetTotalUnderlying(
    uint256 _vaultNumber, 
    address _vault, 
    uint32 _chainId, 
    address _provider
  ) external onlyController {
    bytes4 selector = bytes4(keccak256("receiveGetTotalUnderlying(uint256,address)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _vault);

    xSend(_provider, homeChainId, _chainId, callData);
  }

  /// @notice Receiver for the pushGetTotalUnderlying on each chainId
  /// @dev Gets the totalUnderling plus vault balance and sends back a callback to callbackGetTotalUnderlying on mainchain
  /// @param _vaultNumber number of the vault
  /// @param _vault Address of the Derby Vault on given chainId 
  function receiveGetTotalUnderlying(
    uint256 _vaultNumber, 
    address _vault
  ) external onlyExecutor(xControllerChain) {
    uint256 underlying = IVault(_vault).getTotalUnderlyingIncBalance();

    bytes4 selector = bytes4(keccak256("callbackGetTotalUnderlying(uint256,uint32,uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, homeChainId, underlying);

    xSend(xControllerProvider, homeChainId, xControllerChain, callData);
  }

  /// @notice Callback to receive and set totalUnderlyings from the vaults on mainChain
  /// @param _vaultNumber number of the vault
  /// @param _chainId Number of chain used
  /// @param _underlying totalUnderling plus vault balance in vaultcurrency e.g USDC
  function callbackGetTotalUnderlying(
    uint256 _vaultNumber, 
    uint32 _chainId, 
    uint256 _underlying
  ) external {
    return IXChainController(xController).setTotalUnderlyingCallback(_vaultNumber, _chainId, _underlying);
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

  /// @notice Setter for gameChain Id address
  /// @param _gameChain new address of xProvider for xController chain
  function setGameChainId(uint32 _gameChain) external onlyDao {
    gameChain = _gameChain;
  }

  /// @notice Whitelists the contract for the onlyExecutor modifier
  /// @param _contract address to whitelist
  function whitelistSender(address _contract) external onlyDao {
    senderWhitelist[_contract] = true;
  }

  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }
  
  // function setTotalUnderlying(uint256 _vaultNumber, uint256 _underlying) public {
  //   IXChainController(xController).addTotalChainUnderlying(_vaultNumber, _underlying);
  // }

}