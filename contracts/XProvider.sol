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
  mapping(address => bool) public vaultWhitelist;

  event SetTrustedRemote(uint16 _srcChainId, bytes _srcAddress);

  modifier onlyDao {
    require(msg.sender == dao, "LZProvider: only DAO");
    _;
  }

  modifier onlyController {
    require(msg.sender == xController, "LZProvider: only Controller");
    _;
  }

  modifier onlyVaults {
    require(vaultWhitelist[msg.sender], "LZProvider: only Controller");
    _;
  }

  modifier onlyGame {
    require(msg.sender == game, "LZProvider: only Game");
    _;
  }

  /// @notice Solution for the low-level call in lzReceive that is seen as an external call
  modifier onlySelf() { 
    require(msg.sender == address(this), "LZProvider: only Self");
    _;  
  }

  modifier onlySelfOrVault() { 
    require(
      msg.sender == address(this) ||
      vaultWhitelist[msg.sender], 
      "LZProvider: only Self or Vault"
    );
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
  ) internal {
    require(IERC20(_asset).allowance(msg.sender, address(this)) >= _amount, "LZXProvider: Not approved");

    IERC20(_asset).transferFrom(msg.sender, address(this), _amount);    
    IERC20(_asset).approve(address(connext), _amount);

    CallParams memory callParams = CallParams({
      to: _to,
      callData: "",
      originDomain: _originDomain,
      destinationDomain: _destinationDomain,
      agent: _to,
      recovery: _to,
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
    require(success, "LZReceive: No success");
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
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _underlying TotalUnderling plus vault balance in vaultcurrency e.g USDC
  function pushTotalUnderlying(
    uint256 _vaultNumber, 
    uint16 _chainId, 
    uint256 _underlying
  ) external onlyVaults {
    if (_chainId == xControllerChain) {
      return IXChainController(xController).setTotalUnderlying(_vaultNumber, _chainId, _underlying);
    }
    else {
      bytes4 selector = bytes4(keccak256("receiveTotalUnderlying(uint256,uint16,uint256)"));
      bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _chainId, _underlying);

      xSend(xControllerChain, callData);
    }
  }

  /// @notice Receive and set totalUnderlyings from the vaults for every chainId
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _underlying TotalUnderling plus vault balance in vaultcurrency e.g USDC
  function receiveTotalUnderlying(
    uint256 _vaultNumber, 
    uint16 _chainId, 
    uint256 _underlying
  ) external onlySelf {
    return IXChainController(xController).setTotalUnderlying(_vaultNumber, _chainId, _underlying);
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
    if (_chainId == homeChainId) {
      return IVault(_vault).setXChainAllocation(_amountToSendBack);
    }
    else {
      bytes4 selector = bytes4(keccak256("receiveSetXChainAllocation(address,uint256)"));
      bytes memory callData = abi.encodeWithSelector(selector, _vault, _amountToSendBack);

      xSend(_chainId, callData);
    }
  }

  /// @notice Receiver for the amount the vault has to send back to the xChainController
  /// @param _vault Address of the Derby Vault on given chainId 
  /// @param _amountToSendBack Amount the vault has to send back
  function receiveSetXChainAllocation(
    address _vault,
    uint256 _amountToSendBack
  ) external onlySelf {
    return IVault(_vault).setXChainAllocation(_amountToSendBack);
  }

  /// @notice Transfers funds from vault to xController for crosschain rebalance
  /// @param _vaultNumber Address of the Derby Vault on given chainId 
  /// @param _amount Number of the vault
  /// @param _asset Address of the token to send e.g USDC 
  function xTransferToController(uint256 _vaultNumber, uint256 _amount, address _asset) external onlyVaults {
    if (homeChainId == xControllerChain) {
      IERC20(_asset).transferFrom(msg.sender, xController, _amount);
      IXChainController(xController).upFundsReceived(_vaultNumber);
    }
    else {
      xTransfer(
        xController,
        _asset,
        homeChainId,
        xControllerChain,
        _amount
      );
      pushFeedbackToXController(_vaultNumber); 
    }
  }

  /// @notice Push crosschain feedback to xController to know when the vaultNumber has sent funds
  /// @param _vaultNumber Number of the vault
  function pushFeedbackToXController(uint256 _vaultNumber) internal {
    bytes4 selector = bytes4(keccak256("receiveFeedbackToXController(uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber);

    xSend(xControllerChain, callData);
  }

  /// @notice Receive crosschain feedback to xController to know when the vaultNumber has sent funds
  /// @param _vaultNumber Number of the vault
  function receiveFeedbackToXController(uint256 _vaultNumber) external onlySelf {
    return IXChainController(xController).upFundsReceived(_vaultNumber);
  }

  /// @notice Transfers funds from xController to vault for crosschain rebalance
  /// @param _chainId Number of chainId
  /// @param _amount Amount to send to vault in vaultcurrency
  /// @param _asset Addres of underlying e.g USDC
  function xTransferToVaults(address _vault, uint16 _chainId, uint256 _amount, address _asset) external onlyController {
    xTransfer(
      _vault,
      _asset,
      homeChainId,
      _chainId,
      _amount
    );
    pushFeedbackToVault(_chainId, _vault);
  }

  /// @notice Push feedback message so the vault knows it has received funds and is ready to rebalance
  /// @param _chainId Number of chainId
  /// @param _vault Address of the vault on given chainId
  function pushFeedbackToVault(uint16 _chainId, address _vault) internal {
    bytes4 selector = bytes4(keccak256("receiveFeedbackToVault(address)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vault);

    xSend(_chainId, callData);
  }

  /// @notice Receive feedback message so the vault knows it has received funds and is ready to rebalance
  /// @param _vault Address of the vault on given chainId
  function receiveFeedbackToVault(address _vault) external onlySelfOrVault {
    return IVault(_vault).receiveFunds();
  }

  /// @notice Push protocol allocation array from the game to all vaults/chains
  /// @param _vault Address of the vault on given chainId
  /// @param _deltas Array with delta allocations where the index matches the protocolId
  function pushProtocolAllocationsToVault(
    uint16 _chainId, 
    address _vault, 
    int256[] memory _deltas
  ) external onlyGame {
    if (_chainId == homeChainId) return IVault(_vault).receiveProtocolAllocations(_deltas);
    else {
      bytes4 selector = bytes4(keccak256("receiveProtocolAllocationsToVault(address,int256[])"));
      bytes memory callData = abi.encodeWithSelector(selector, _vault, _deltas);

      xSend(_chainId, callData);
    }
  }

  /// @notice Receives protocol allocation array from the game to all vaults/chains
  /// @param _vault Address of the vault on given chainId
  /// @param _deltas Array with delta allocations where the index matches the protocolId
  function receiveProtocolAllocationsToVault(address _vault, int256[] memory _deltas) external onlySelf {
    return IVault(_vault).receiveProtocolAllocations(_deltas);
  }

  /// @notice set trusted provider on remote chains, allow owner to set it multiple times.
  /// @param _srcChainId Chain is for remote xprovider, some as the remote receiving contract chain id (xReceive)
  /// @param _srcAddress Address of remote xprovider
  function setTrustedRemote(uint16 _srcChainId, bytes calldata _srcAddress) external onlyDao {
    trustedRemoteLookup[_srcChainId] = _srcAddress;
    emit SetTrustedRemote(_srcChainId, _srcAddress);
  }

  /// @notice Setter for xControllerProvider address
  /// @param _xControllerProvider New address of xProvider for xController chain
  function setXControllerProvider(address _xControllerProvider) external onlyDao {
    xControllerProvider = _xControllerProvider;
  }

  /// @notice Setter for xControllerProvider address
  /// @param _xControllerChain New address of xProvider for xController chain
  function setXControllerChainId(uint16 _xControllerChain) external onlyDao {
    xControllerChain = _xControllerChain;
  }

  /// @notice Setter for gameChain Id address
  /// @param _gameChain New address of xProvider for xController chain
  function setGameChainId(uint16 _gameChain) external onlyDao {
    gameChain = _gameChain;
  }

  /// @notice Whitelists vault address for onlyVault modifier
  function toggleVaultWhitelist(address _vault) external onlyDao {
    vaultWhitelist[_vault] = !vaultWhitelist[_vault];
  }

  /// @notice Setter for dao address
  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }
}