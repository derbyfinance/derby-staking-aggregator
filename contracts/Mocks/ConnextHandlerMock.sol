// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import {XCallArgs, CallParams} from "../libraries/LibConnextStorage.sol";
import "../Interfaces/ExternalInterfaces/IExecutor.sol";
import "../Interfaces/ExternalInterfaces/IConnextHandler.sol";

contract ConnextHandlerMock is IConnextHandler {
    address public executor;
    address public dao;

    constructor (address _dao) {
        dao = _dao;
    }

    modifier onlyDao {
      require(msg.sender == dao, "ConnextHandler: only DAO");
      _;
    }

    function setExecutor(address _executor) external onlyDao {
        executor = _executor;
    }

    function xcall(XCallArgs calldata _args) external payable returns (bytes32) {
        IExecutor.ExecutorArgs memory exArgs;
        exArgs.to = _args.params.to;
        exArgs.callData = _args.params.callData;
        IExecutor(executor).execute(exArgs);
    }
}