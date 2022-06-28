// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IETFVault.sol";
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

  function xCall(IXProvider.callParams memory params) public {
    (bool success,) = params.to.call(params.callData);
    require(success, "No success");
  }

  function getTotalUnderlying(uint256 _ETFNumber, address _ETFVault) public {
    uint256 underlying = IETFVault(_ETFVault).getTotalUnderlyingIncBalance();

    bytes4 selector = bytes4(keccak256("setTotalUnderlying(uint256,uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _ETFNumber, underlying);
    address xProviderAddr = address(this);

    IXProvider.callParams memory callParams = IXProvider.callParams({
      to: xProviderAddr,
      chainId: 0,
      callData: callData
    });

    xCall(callParams);
  }
  
  function setTotalUnderlying(uint256 _ETFNumber, uint256 _underlying) public {
    IXChainController(xController).addTotalChainUnderlying(_ETFNumber, _underlying);
  }

}