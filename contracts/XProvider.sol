// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IVault.sol";
import "./Interfaces/IXProvider.sol";
import "./Interfaces/IXChainController.sol";
import "./Mocks/LayerZero/interfaces/ILayerZeroEndpoint.sol";
import "./Mocks/LayerZero/interfaces/ILayerZeroReceiver.sol";

import "hardhat/console.sol";

contract XProvider is ILayerZeroReceiver {
  ILayerZeroEndpoint public endpoint;

  address public xController;
  address public xControllerProvider;
  address public receiveProvider;
  address public dao;
  address public game;

  uint16 public homeChainId;
  uint16 public xControllerChain;
  uint16 public gameChain;

  mapping(address => bool) internal senderWhitelist;
  mapping(uint16 => bytes) public trustedRemoteLookup;

  event SetTrustedRemote(uint16 _srcChainId, bytes _srcAddress);

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

  modifier onlyExecutor(uint16 _chain) { 
    // require(
    //   senderWhitelist[IExecutorMock(msg.sender).originSender()] &&
    //   IExecutorMock(msg.sender).origin() == _chain &&
    //   msg.sender == executor,
    //   "!Executor"
    // ); 
    _;  
  }
  
  constructor(
    address _endpoint,
    address _dao,
    address _game,
    address _xController,
    uint16 _homeChainId
  ) {
    endpoint = ILayerZeroEndpoint(_endpoint);
    dao = _dao;
    game = _game;
    xController = _xController;
    homeChainId = _homeChainId;
  }

  /// @notice Function to send an integer value crosschain
  /// @param _to address of the contract on receiving chain
  /// @param _originDomain Chain Id of sender chain
  /// @param _destinationDomain chain Id of destination chain
  /// @param _callData Function selector to call on receiving chain with params
  function xSend(
    address _to,
    uint16 _originDomain,
    uint16 _destinationDomain,
    bytes memory _callData
  ) internal {
    bytes memory trustedRemote = trustedRemoteLookup[_destinationDomain]; // same chainID as the provider on the receiverChain 
    require(trustedRemote.length != 0, "LzApp: destination chain is not a trusted source");

    endpoint.send(_destinationDomain, trustedRemote, _callData, payable(msg.sender), address(0x0), bytes(""));
  }

  function lzReceive(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _payload) external {
    console.log("lz receive");
    require(msg.sender == address(endpoint));
    require(_srcAddress.length == trustedRemoteLookup[_srcChainId].length && keccak256(_srcAddress) == keccak256(trustedRemoteLookup[_srcChainId]));

    (bool success,) = address(this).call(_payload);
    require(success, "LZXProviderMock: lzReceive: No success");
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
    uint16 _chainId, 
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

    bytes4 selector = bytes4(keccak256("callbackGetTotalUnderlying(uint256,uint16,uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, homeChainId, underlying);

    xSend(xControllerProvider, homeChainId, xControllerChain, callData);
  }

  /// @notice Callback to receive and set totalUnderlyings from the vaults on mainChain
  /// @param _vaultNumber number of the vault
  /// @param _chainId Number of chain used
  /// @param _underlying totalUnderling plus vault balance in vaultcurrency e.g USDC
  function callbackGetTotalUnderlying(
    uint256 _vaultNumber, 
    uint16 _chainId, 
    uint256 _underlying
  ) external {
    return IXChainController(xController).setTotalUnderlyingCallback(_vaultNumber, _chainId, _underlying);
  }

  /// @notice Pushes the amount the vault has to send back to the xChainController
  /// @param _vault Address of the Derby Vault on given chainId
  /// @param _chainId Number of chain used
  /// @param _amountToSendBack Amount the vault has to send back
  /// @param _provider Address of the xProvider on given chainId 
  function pushSetXChainAllocation(
    address _vault, 
    uint16 _chainId, 
    uint256 _amountToSendBack,
    address _provider
  ) external onlyController {
    bytes4 selector = bytes4(keccak256("receiveSetXChainAllocation(address,uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vault, _amountToSendBack);

    xSend(_provider, homeChainId, _chainId, callData);
  }

  /// @notice Receiver for the amount the vault has to send back to the xChainController
  /// @param _vault Address of the Derby Vault on given chainId 
  /// @param _amountToSendBack Amount the vault has to send back
  function receiveSetXChainAllocation(
    address _vault,
    uint256 _amountToSendBack
  ) external onlyExecutor(xControllerChain) {
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