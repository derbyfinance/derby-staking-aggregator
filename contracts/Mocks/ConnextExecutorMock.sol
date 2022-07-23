// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import {LibCrossDomainProperty, TypedMemView} from "../libraries/LibCrossDomainProperty.sol";
import "./interfaces/IExecutorMock.sol";

contract ConnextExecutorMock is IExecutorMock {
    address private immutable connext;
    address private originSender_;
    uint32 private origin_;
    bytes private properties = LibCrossDomainProperty.EMPTY_BYTES;

    constructor(address _connext) {
        connext = _connext;
    }
    
    modifier onlyConnext() {
        require(msg.sender == connext, "ConnextExecutorMock: !connext");
        _;
    }

    function originSender() external view override returns (address) {
        return originSender_;
    }

    function origin() external view override returns (uint32) {
        return origin_;
    }

    function execute(ExecutorArgs memory _args) external payable  onlyConnext returns (bool success, bytes memory returnData) {
        originSender_ = _args.originSender;
        origin_ = _args.origin;
        (bool success,) = _args.to.call(_args.callData);
        require(success, "ConnextExecutorMock: No success");       
    }
}