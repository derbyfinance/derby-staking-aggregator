// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import {XCallArgs, CallParams} from "../../libraries/LibConnextStorage.sol";
import "./interfaces/IExecutorMock.sol";
import "../../Interfaces/ExternalInterfaces/IConnextHandler.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

contract ConnextHandlerMock is IConnextHandler {
  using SafeERC20 for IERC20;

  address public executor;
  address public dao;

  constructor(address _dao) {
    dao = _dao;
  }

  modifier onlyDao() {
    require(msg.sender == dao, "ConnextHandler: only DAO");
    _;
  }

  function setExecutor(address _executor) external onlyDao {
    executor = _executor;
  }

  function getExecutor() external view returns (address) {
    return executor;
  }

  function xcall(XCallArgs calldata _args) external payable returns (bytes32) {
    // split logic for messaging and transfer of value
    if (_args.transactingAssetId == address(0)) {
      // message
      IExecutorMock.ExecutorArgs memory exArgs;
      exArgs.to = _args.params.to;
      exArgs.callData = _args.params.callData;
      exArgs.originSender = _args.params.recovery;
      exArgs.origin = _args.params.originDomain;
      IExecutorMock(executor).execute(exArgs);
    } else {
      // transfer of value
      IERC20(_args.transactingAssetId).transferFrom(msg.sender, _args.params.to, _args.amount);
    }
  }
}
