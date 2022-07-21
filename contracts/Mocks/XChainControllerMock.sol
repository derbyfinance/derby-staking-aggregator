// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../XChainController.sol";
import "hardhat/console.sol";

contract XChainControllerMock is XChainController {
  constructor(address _game, address _dao) XChainController(_game, _dao) {} 

  function setActiveVaultsTEST(uint256 _vaultNumber, uint256 _activeVaults) external {
    return setActiveVaults(_vaultNumber, _activeVaults);
  }

  function setReadyTEST(uint256 _vaultNumber, bool _state) external {
    return setReady(_vaultNumber, _state);
  }

  function setAllocationsReceivedTEST(uint256 _vaultNumber, bool _state) external {
    return setAllocationsReceived(_vaultNumber, _state);
  }

  function upUnderlyingReceivedTEST(uint256 _vaultNumber) external {
    return upUnderlyingReceived(_vaultNumber);
  }

  function resetVaultStagesTEST(uint256 _vaultNumber) external {
    return resetVaultStages(_vaultNumber);
  }

  function upFundsReceivedTEST(uint256 _vaultNumber) external {
    return upFundsReceived(_vaultNumber);
  }

  function getVaultState(uint256 _vaultNumber) external view returns(bool) {
    return vaultStage[_vaultNumber].ready;
  }

  function getAllocationState(uint256 _vaultNumber) external view returns(bool) {
    return vaultStage[_vaultNumber].allocationsReceived;
  }

  function getUnderlyingState(uint256 _vaultNumber) external view returns(uint256) {
    return vaultStage[_vaultNumber].underlyingReceived;
  }

  function getFundsReceivedState(uint256 _vaultNumber) external view returns(uint256) {
    return vaultStage[_vaultNumber].fundsReceived;
  }

  function getCurrentTotalAllocationTEST(uint256 _vaultNumber) external view returns(int256) {
    return getCurrentTotalAllocation(_vaultNumber);
  }

  function getCurrentAllocationTEST(uint256 _vaultNumber, uint256 _chainId) external view returns(int256) {
    return getCurrentAllocation(_vaultNumber, _chainId);
  }
}