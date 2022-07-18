// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../XChainController.sol";
import "hardhat/console.sol";

contract XChainControllerMock is XChainController {
  constructor(address _game, address _dao) XChainController(_game, _dao) {} 

  function setReadyTEST(uint256 _vaultNumber, bool _state) external {
    return setReady(_vaultNumber, _state);
  }
  function setAllocationsReceivedTEST(uint256 _vaultNumber, bool _state) external {
    return setAllocationsReceived(_vaultNumber, _state);
  }
  function upUnderlyingReceivedTEST(uint256 _vaultNumber) external {
    return upUnderlyingReceived(_vaultNumber);
  }
  function upFundsReceivedTEST(uint256 _vaultNumber) external {
    return upFundsReceived(_vaultNumber);
  }
}