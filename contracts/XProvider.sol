// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {XCallArgs, CallParams} from "./libraries/LibConnextStorage.sol";

import "./Interfaces/IVault.sol";
import "./Interfaces/IXProvider.sol";
import "./Interfaces/IXChainController.sol";
import "./Mocks/LayerZero/interfaces/ILayerZeroEndpoint.sol";
import "./Mocks/LayerZero/interfaces/ILayerZeroReceiver.sol";
import "./Interfaces/ExternalInterfaces/IConnextHandler.sol";

import "hardhat/console.sol";

contract XProvider is ILayerZeroReceiver {
  using SafeERC20 for IERC20;

  ILayerZeroEndpoint public immutable endpoint;
  IConnextHandler public immutable connext;

  address public xController;
  address public xControllerProvider;
  address public dao;
  address public game;

  uint16 public homeChainId;
  uint16 public xControllerChain;
  uint16 public gameChain;

  mapping(uint16 => bytes) public trustedRemoteLookup;

  event SetTrustedRemote(uint16 _srcChainId, bytes _srcAddress);

  modifier onlyDao {
    require(msg.sender == dao, "LZProvider: only DAO");
    _;
  }

  modifier onlyController {
    require(msg.sender == xController, "LZProvider: only Controller");
    _;
  }

  modifier onlyGame {
    require(msg.sender == game, "LZProvider: only Game");
    _;
  }

  modifier onlySelf() { 
    require(msg.sender == address(this), "LZProvider: only Self");
    _;  
  }
  
  constructor(
    address _endpoint,
    address _connextHandler,
    address _dao,
    address _game,
    address _xController,
    uint16 _homeChainId
  ) {
    endpoint = ILayerZeroEndpoint(_endpoint);
    connext = IConnextHandler(_connextHandler);
    dao = _dao;
    game = _game;
    xController = _xController;
    homeChainId = _homeChainId;
  }

  /// @notice Function to send function selectors crossChain
  /// @param _destinationDomain chain Id of destination chain
  /// @param _callData Function selector to call on receiving chain with params
  function xSend(
    uint16 _destinationDomain,
    bytes memory _callData
  ) internal {
    bytes memory trustedRemote = trustedRemoteLookup[_destinationDomain]; // same chainID as the provider on the receiverChain 
    require(trustedRemote.length != 0, "LZProvider: destination chain not trusted");

    endpoint.send(_destinationDomain, trustedRemote, _callData, payable(msg.sender), address(0x0), bytes(""));
  }

  function xTransfer(
    address _to, 
    address _asset, 
    uint32 _originDomain, 
    uint32 _destinationDomain, 
    uint256 _amount
  ) external {
    IERC20 token = IERC20(_asset);    
    require(token.allowance(msg.sender, address(this)) >= _amount, "LZXProvider: User must approve amount");
    token.transferFrom(msg.sender, address(this), _amount);    
    token.approve(address(connext), _amount);

    CallParams memory callParams = CallParams({
      to: _to,      
      callData: "",      
      originDomain: _originDomain,      
      destinationDomain: _destinationDomain,      
      agent: _to,      
      recovery: _too,      
      forceSlow: false,      
      receiveLocal: false,      
      callback: address(0),      
      callbackFee: 0,      
      relayerFee: 0,      
      slippageTol: 9995    
    });

    XCallArgs memory xcallArgs = XCallArgs({
      params: callParams,      
      transactingAssetId: _asset, 
      amount: _amount  
    });  

    connext.xcall(xcallArgs);
  }

  function lzReceive(
    uint16 _srcChainId, 
    bytes calldata _srcAddress, 
    uint64 _nonce, 
    bytes calldata _payload
  ) external {
    require(msg.sender == address(endpoint), "Not an endpoint");
    require(_srcAddress.length == trustedRemoteLookup[_srcChainId].length && keccak256(_srcAddress) == keccak256(trustedRemoteLookup[_srcChainId]), "Not trusted");

    (bool success,) = address(this).call(_payload);
    require(success, "LZProvider: lzReceive: No success");
  }

  /// @notice Pushes the delta allocations from the game to the xChainController
  /// @param _vaultNumber number of the vault
  /// @param _deltas Array with delta Allocations for all chainIds
  function pushAllocations(uint256 _vaultNumber, int256[] memory _deltas) external onlyGame {
    bytes4 selector = bytes4(keccak256("receiveAllocations(uint256,int256[])"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _deltas);

    xSend(xControllerChain, callData);
  }

  /// @notice Receives the delta allocations from the game and routes to xChainController
  /// @param _vaultNumber number of the vault
  /// @param _deltas Array with delta Allocations for all chainIds
  function receiveAllocations(uint256 _vaultNumber, int256[] memory _deltas) external onlySelf {
    return IXChainController(xController).receiveAllocationsFromGame(_vaultNumber, _deltas);
  }

  /// @notice Pushes cross chain requests for the totalUnderlying for a vaultNumber on a chainId
  /// @param _vaultNumber number of the vault
  /// @param _vault Address of the Derby Vault on given chainId
  /// @param _chainId Number of chain used
  function pushGetTotalUnderlying(
    uint256 _vaultNumber, 
    address _vault, 
    uint16 _chainId
  ) external onlyController {
    bytes4 selector = bytes4(keccak256("receiveGetTotalUnderlying(uint256,address)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _vault);

    xSend(_chainId, callData);
  }

  /// @notice Receiver for the pushGetTotalUnderlying on each chainId
  /// @dev Gets the totalUnderling plus vault balance and sends back a callback to callbackGetTotalUnderlying on mainchain
  /// @param _vaultNumber number of the vault
  /// @param _vault Address of the Derby Vault on given chainId 
  function receiveGetTotalUnderlying(
    uint256 _vaultNumber, 
    address _vault
  ) external onlySelf {
    uint256 underlying = IVault(_vault).getTotalUnderlyingIncBalance();

    bytes4 selector = bytes4(keccak256("callbackGetTotalUnderlying(uint256,uint16,uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, homeChainId, underlying);

    xSend(xControllerChain, callData);
  }

  /// @notice Callback to receive and set totalUnderlyings from the vaults on mainChain
  /// @param _vaultNumber number of the vault
  /// @param _chainId Number of chain used
  /// @param _underlying totalUnderling plus vault balance in vaultcurrency e.g USDC
  function callbackGetTotalUnderlying(
    uint256 _vaultNumber, 
    uint16 _chainId, 
    uint256 _underlying
  ) external onlySelf {
    return IXChainController(xController).setTotalUnderlyingCallback(_vaultNumber, _chainId, _underlying);
  }

  /// @notice Pushes the amount the vault has to send back to the xChainController
  /// @param _vault Address of the Derby Vault on given chainId
  /// @param _chainId Number of chain used
  /// @param _amountToSendBack Amount the vault has to send back
  function pushSetXChainAllocation(
    address _vault, 
    uint16 _chainId, 
    uint256 _amountToSendBack
  ) external onlyController {
    bytes4 selector = bytes4(keccak256("receiveSetXChainAllocation(address,uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vault, _amountToSendBack);

    xSend(_chainId, callData);
  }

  /// @notice Receiver for the amount the vault has to send back to the xChainController
  /// @param _vault Address of the Derby Vault on given chainId 
  /// @param _amountToSendBack Amount the vault has to send back
  function receiveSetXChainAllocation(
    address _vault,
    uint256 _amountToSendBack
  ) external onlySelf {
    IVault(_vault).setXChainAllocation(_amountToSendBack);
  }

  /// @notice set trusted provider on remote chains, allow owner to set it multiple times.
  /// @param _srcChainId chain is for remote xprovider, some as the remote receiving contract chain id (xReceive)
  /// @param _srcAddress address of remote xprovider
  function setTrustedRemote(uint16 _srcChainId, bytes calldata _srcAddress) external onlyDao {
    trustedRemoteLookup[_srcChainId] = _srcAddress;
    emit SetTrustedRemote(_srcChainId, _srcAddress);
  }

  /// @notice Setter for xControllerProvider address
  /// @param _xControllerProvider new address of xProvider for xController chain
  function setXControllerProvider(address _xControllerProvider) external onlyDao {
    xControllerProvider = _xControllerProvider;
  }

  /// @notice Setter for xControllerProvider address
  /// @param _xControllerChain new address of xProvider for xController chain
  function setXControllerChainId(uint16 _xControllerChain) external onlyDao {
    xControllerChain = _xControllerChain;
  }

  /// @notice Setter for gameChain Id address
  /// @param _gameChain new address of xProvider for xController chain
  function setGameChainId(uint16 _gameChain) external onlyDao {
    gameChain = _gameChain;
  }

  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }
}