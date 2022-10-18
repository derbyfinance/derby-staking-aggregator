// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "../MainVault.sol";
import "hardhat/console.sol";

contract FeeTestContract is MainVault {
  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    string memory _vaultName,
    uint256 _vaultNumber,
    address _governed,
    address _Game,
    address _router,
    address _vaultCurrency,
    uint256 _uScale,
    uint256 _gasFeeLiquidity
  )
    MainVault(
      _name,
      _symbol,
      _decimals,
      _vaultNumber,
      _governed,
      _governed,
      _Game,
      _router,
      _vaultCurrency,
      _uScale,
      _gasFeeLiquidity
    )
  {}

  uint256 public latestProtocol;

  uint256 private testmooi = 12;

  uint256[] public protocolsInETF;

  mapping(uint256 => int256) private test;

  function loopArray() public {
    for (uint i = 0; i < protocolsInETF.length; i++) {
      int256 amount = currentAllocations[protocolsInETF[i]];
      test[i] = amount;
    }
  }

  function loopMapping() public {
    for (uint i = 0; i <= latestProtocol; i++) {
      int256 amount = currentAllocations[i];
      if (amount == 0) continue;
      test[i] = amount;
    }
  }

  function setArray(uint256 _protocol) public {
    protocolsInETF.push(_protocol);
  }

  function setMapping(uint256 _protocol, int256 _amount) public {
    currentAllocations[_protocol] = _amount;
  }

  function setLatestProtol(uint256 _amount) public {
    latestProtocol = _amount;
  }

  function deleteArray() public {
    delete protocolsInETF;
  }
}
