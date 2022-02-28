// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../Providers/CompoundProvider.sol";

contract CompoundProviderMock is CompoundProvider { 

  constructor(address _cToken, address _uToken, address _router, address _comptroller) CompoundProvider(
    _cToken,
    _uToken,
    _router,
    _comptroller
  ) {}

  function claimTest(address _address) public {
    address[] memory cTokens = new address[](1);
    cTokens[0] = protocolToken;
    comptroller.claimComp(_address, cTokens);
  }
}
