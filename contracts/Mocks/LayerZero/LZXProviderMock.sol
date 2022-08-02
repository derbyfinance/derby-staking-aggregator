// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../Connext/interfaces/IXProviderMock.sol";
import "../Connext/interfaces/IXReceiveMock.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "./interfaces/ILayerZeroReceiver.sol";

contract LZXProviderMock is IXProviderMock, ILayerZeroReceiver {
    ILayerZeroEndpoint public endpoint;
    address public dao;
    address xReceiveMock;
    uint16 xReceiveMockChainID;
    mapping(uint16 => bytes) public trustedRemoteLookup;

    event SetTrustedRemote(uint16 _srcChainId, bytes _srcAddress);

    modifier onlyDao {
      require(msg.sender == dao, "ConnextProvider: only DAO");
      _;
    }

    constructor(address _endpoint, address _dao){
        endpoint = ILayerZeroEndpoint(_endpoint);
        dao = _dao;
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
}