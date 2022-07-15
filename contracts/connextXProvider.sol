// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IVault.sol";
import "./Interfaces/IXProvider.sol";
import "./Interfaces/IXChainController.sol";

import "hardhat/console.sol";

contract connextXProvider {
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

  function getTotalUnderlying(uint256 _ETFNumber, address _vault) public {
    uint256 underlying = IVault(_vault).getTotalUnderlyingIncBalance();

    bytes4 selector = bytes4(keccak256("setTotalUnderlying(uint256,uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _ETFNumber, underlying);

    // callback
    xCall(address(this), 0, callData);
  }
  
  function setTotalUnderlying(uint256 _ETFNumber, uint256 _underlying) public {
    IXChainController(xController).addTotalChainUnderlying(_ETFNumber, _underlying);
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