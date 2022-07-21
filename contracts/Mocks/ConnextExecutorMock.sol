// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import {XCallArgs, CallParams} from "../libraries/LibConnextStorage.sol";
import "../Interfaces/ExternalInterfaces/IExecutor.sol";

abstract contract ConnextExecutorMock is IExecutor {
    
    constructor(){}

    function execute(ExecutorArgs memory _args) external payable returns (bool success, bytes memory returnData) {
        (bool success,) = _args.to.call(_args.callData);
        require(success, "No success");       
    }
}