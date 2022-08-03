// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../Connext/interfaces/IXProviderMock.sol";
import "../Connext/interfaces/IXReceiveMock.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "./interfaces/ILayerZeroReceiver.sol";
import "../../Interfaces/ExternalInterfaces/IConnextHandler.sol"; // https://github.com/connext/nxtp/blob/main/packages/deployments/contracts/contracts/core/connext/interfaces/IConnextHandler.sol
import {XCallArgs, CallParams} from "../../libraries/LibConnextStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LZXProviderMock is IXProviderMock, ILayerZeroReceiver {
    using SafeERC20 for IERC20;

    ILayerZeroEndpoint public endpoint;
    IConnextHandler public immutable connext;
    address public dao;
    address xReceiveMock;
    uint16 xReceiveMockChainID;
    mapping(uint16 => bytes) public trustedRemoteLookup;

    event SetTrustedRemote(uint16 _srcChainId, bytes _srcAddress);

    modifier onlyDao {
      require(msg.sender == dao, "ConnextProvider: only DAO");
      _;
    }

    constructor(address _endpoint, address _dao, address _connextHandler){
        endpoint = ILayerZeroEndpoint(_endpoint);
        dao = _dao;
        connext = IConnextHandler(_connextHandler);
    }

    /// @notice setter for the receiver contract parameters, always needs to be set, could be a list when multiple contracts on the sending chain have to send values.
    /// @param _xReceiveMock address of receiving contract, e.g. xChainController contract to send game totalAllocations to xChainController
    /// @param _xReceiveMockChainID chain id of receiving contract, e.g. ethereum, where the xChainController lives
    function setxReceiveMock(address _xReceiveMock, uint16 _xReceiveMockChainID) external onlyDao {
        xReceiveMock = _xReceiveMock;
        xReceiveMockChainID = _xReceiveMockChainID;
    }

    /// @notice set trusted provider on remote chains, allow owner to set it multiple times.
    /// @param _srcChainId chain is for remote xprovider, some as the remote receiving contract chain id (xReceive)
    /// @param _srcAddress address of remote xprovider
    function setTrustedRemote(uint16 _srcChainId, bytes calldata _srcAddress) external onlyDao {
        trustedRemoteLookup[_srcChainId] = _srcAddress;
        emit SetTrustedRemote(_srcChainId, _srcAddress);
    }
    
    /// @notice Function to send an integer value crosschain
    /// @param _value Value to send crosschain.
    function xSend(
        uint256 _value
    ) external {
        bytes memory trustedRemote = trustedRemoteLookup[xReceiveMockChainID]; // same chainID as the provider on the receiverChain 
        require(trustedRemote.length != 0, "LzApp: destination chain is not a trusted source");

        bytes4 selector = bytes4(keccak256("xReceive(uint256)"));    
        bytes memory callData = abi.encodeWithSelector(selector, _value);
        endpoint.send(xReceiveMockChainID, trustedRemote, callData, payable(msg.sender), address(0x0), bytes(""));
    }

    function lzReceive(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _payload) external {
        require(msg.sender == address(endpoint));
        require(_srcAddress.length == trustedRemoteLookup[_srcChainId].length && keccak256(_srcAddress) == keccak256(trustedRemoteLookup[_srcChainId]));

        (bool success,) = address(this).call(_payload);
        require(success, "LZXProviderMock: lzReceive: No success");
    }

    /// @notice Function to receive value crosschain, onlyExecutor modifier makes sure only xSend can actually send the value
    /// @param _value Value to send crosschain.
    function xReceive(uint256 _value) external {
        IXReceiveMock(xReceiveMock).xReceiveAndSetSomeValue(_value);
    }

    function xTransfer(address to, address asset, uint32 originDomain, uint32 destinationDomain, uint256 amount) external {
        IERC20 token = IERC20(asset);    
        require(token.allowance(msg.sender, address(this)) >= amount, "LZXProvider: User must approve amount");
        token.transferFrom(msg.sender, address(this), amount);    
        token.approve(address(connext), amount);

        CallParams memory callParams = CallParams({
            to: to,      
            callData: "",      
            originDomain: originDomain,      
            destinationDomain: destinationDomain,      
            agent: to,      
            recovery: to,      
            forceSlow: false,      
            receiveLocal: false,      
            callback: address(0),      
            callbackFee: 0,      
            relayerFee: 0,      
            slippageTol: 9995    
        });

        XCallArgs memory xcallArgs = XCallArgs({
            params: callParams,      
            transactingAssetId: asset, 
            amount: amount  
        });    
        connext.xcall(xcallArgs);
    }
}