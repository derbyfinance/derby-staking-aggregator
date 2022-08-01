// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./interfaces/IExecutorMock.sol";
import "hardhat/console.sol";

contract ConnextExecutorMock is IExecutorMock {
    address private immutable connext;
    address private originSender_;
    uint32 private origin_;

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

    function execute(ExecutorArgs memory _args) external override payable onlyConnext {
        originSender_ = _args.originSender;
        origin_ = _args.origin;
        (bool success,) = _args.to.call(_args.callData);
        require(success, "ConnextExecutorMock: No success");       
    }
}