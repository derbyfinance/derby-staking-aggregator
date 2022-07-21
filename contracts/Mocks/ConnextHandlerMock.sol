// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import {XCallArgs, CallParams} from "../libraries/LibConnextStorage.sol";
import "../Interfaces/ExternalInterfaces/IExecutor.sol";
import "../Interfaces/ExternalInterfaces/IConnextHandler.sol";

abstract contract ConnextHandlerMock is IConnextHandler, IExecutor {
    address public executor;

    constructor(address _executor){
        executor = _executor;
    }

    function xcall(XCallArgs calldata _args) external payable returns (bytes32) {
        ExecutorArgs memory exArgs;
        exArgs.to = _args.params.to;
        exArgs.callData = _args.params.callData;
        IExecutor(executor).execute(exArgs);
    }
}