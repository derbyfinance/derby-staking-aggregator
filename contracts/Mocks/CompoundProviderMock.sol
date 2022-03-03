// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../Providers/CompoundProvider.sol";

contract CompoundProviderMock is CompoundProvider { 

  constructor(address _router, address _comptroller) CompoundProvider(
    _router,
    _comptroller
  ) {}

  function claimTest(address _address, address _cToken) public {
    address[] memory cTokens = new address[](1);
    cTokens[0] = _cToken;
    comptroller.claimComp(_address, cTokens);
  }
}
