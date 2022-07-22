// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import {LibCrossDomainProperty, TypedMemView} from "../libraries/LibCrossDomainProperty.sol";
import "./interfaces/IExecutorMock.sol";

contract ConnextExecutorMock is IExecutorMock {
    address private immutable connext;
    bytes private properties = LibCrossDomainProperty.EMPTY_BYTES;

    constructor(address _connext) {
        connext = _connext;
    }
    
    modifier onlyConnext() {
        require(msg.sender == connext, "ConnextExecutorMock: !connext");
        _;
    }

    function originSender() external view override returns (address) {
        // The following will revert if it is empty
        bytes29 _parsed = LibCrossDomainProperty.parseDomainAndSenderBytes(properties);
        return LibCrossDomainProperty.sender(_parsed);
    }

    /**
    * @notice Allows a `_to` contract to access origin domain (i.e. domain of `xcall`)
    * @dev These properties are set via reentrancy a la L2CrossDomainMessenger from
    * optimism
    */
    function origin() external view override returns (uint32) {
        // The following will revert if it is empty
        bytes29 _parsed = LibCrossDomainProperty.parseDomainAndSenderBytes(properties);
        return LibCrossDomainProperty.domain(_parsed);
    }

    function execute(ExecutorArgs memory _args) external payable  onlyConnext returns (bool success, bytes memory returnData) {
        (bool success,) = _args.to.call(_args.callData);
        require(success, "ConnextExecutorMock: No success");       
    }
}