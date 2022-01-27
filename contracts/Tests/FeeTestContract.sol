// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "hardhat/console.sol";

contract FeeTestContract {
  uint256 public totalAllocatedTokens;
  uint256 public latestProtocol;

  uint256 private testmooi = 12;

  uint256[] public protocolsInETF;

  mapping(uint256 => uint256) private currentAllocations;

  mapping(uint256 => uint256) private test;

  function loopArray() public {
    for (uint i = 0; i < protocolsInETF.length; i++) {
      uint256 amount = currentAllocations[protocolsInETF[i]];
      test[i] = amount;
    }
  }

  function loopMapping() public {
    for (uint i = 0; i <= latestProtocol; i++) {
      uint256 amount = currentAllocations[i];
      if (amount == 0) continue;
      test[i] = amount;
    }
  }

  function setArray(uint256 _protocol) public {
    protocolsInETF.push(_protocol);
  }

  function setMapping(uint256 _protocol, uint256 _amount) public {
    currentAllocations[_protocol] = _amount;
  }

  function setLatestProtol(uint256 _amount) public {
    latestProtocol = _amount;
  }

  function deleteArray() public {
    delete protocolsInETF;
  }
}