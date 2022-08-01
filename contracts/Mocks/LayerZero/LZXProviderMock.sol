// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../Connext/interfaces/IXProviderMock.sol";

contract LZXProviderMock is IXProviderMock {
    constructor(){

    }
    
    /// @notice Function to send an integer value crosschain
    /// @param _value Value to send crosschain.
    function xSend(
        uint256 _value
    ) external {

    }

    /// @notice Function to receive value crosschain, onlyExecutor modifier makes sure only xSend can actually send the value
    /// @param _value Value to send crosschain.
    function xReceive(uint256 _value) external {

    }
}