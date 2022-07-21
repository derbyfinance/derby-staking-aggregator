// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IVault.sol";
import "./Interfaces/IXProvider.sol";
import "./Interfaces/IXChainController.sol";

import "hardhat/console.sol";

contract XProvider {
  address xController;
  
  constructor(address _xController) {
    xController = _xController;
  }

  function xTransfer() external {

  }

  function xCall(
    address _xProvider, 
    uint256 _chainId, 
    bytes memory _callData
  ) public {
    IXProvider.callParams memory params = IXProvider.callParams({
      to: _xProvider,
      chainId: _chainId,
      callData: _callData
    });

    (bool success,) = params.to.call(params.callData);
    require(success, "No success");
  }

  function pushAllocationsToController(uint256 _vaultNumber, int256[] memory _deltas) public {
    bytes4 selector = bytes4(keccak256("receiveAllocationsFromGame(uint256,int256[])"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _deltas);

    xCall(xController, 0, callData);
  }

  function getTotalUnderlying(uint256 _vaultNumber, address _vault) public {
    uint256 underlying = IVault(_vault).getTotalUnderlyingIncBalance();

    bytes4 selector = bytes4(keccak256("setTotalUnderlying(uint256,uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, underlying);

    // callback
    xCall(address(this), 0, callData);
  }
  
  function setTotalUnderlying(uint256 _vaultNumber, uint256 _underlying) public {
    IXChainController(xController).addTotalChainUnderlying(_vaultNumber, _underlying);
  }

  // function createCallParams(
  //   address _xProvider, 
  //   uint256 _chainId, 
  //   bytes memory _callData
  // ) internal returns (IXProvider.callParams memory params) {
  //   params = IXProvider.callParams({
  //     to: _xProvider,
  //     chainId: _chainId,
  //     callData: _callData
  //   });
  // }

}