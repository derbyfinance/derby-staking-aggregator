// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "./Interfaces/IProvider.sol";

contract Router {
  mapping(uint256 => mapping(uint256 => address)) public protocol; 

  // Modifier for only vault?

  function deposit(
    uint256 _ETFnumber, 
    uint256 _protocolNumber, 
    address _buyer, 
    uint256 _amount
    ) 
    external returns(uint256) {
    return IProvider(protocol[_ETFnumber][_protocolNumber]).deposit(_buyer, _amount);
  }

  function withdraw(
    uint256 _ETFnumber, 
    uint256 _protocolNumber, 
    address _seller, 
    uint256 _balance
    ) 
    external returns(uint256) {
    return IProvider(protocol[_ETFnumber][_protocolNumber]).withdraw(_seller, _balance);
  }

  function exchangeRate(
    uint256 _ETFnumber, 
    uint256 _protocolNumber
    ) 
    external view returns(uint256) {
    return IProvider(protocol[_ETFnumber][_protocolNumber]).exchangeRate();
  }

  function addProtocol(
    uint256 _ETFnumber, 
    uint256 _protocolNumber, 
    address _provider
    ) 
    external { 
    protocol[_ETFnumber][_protocolNumber] = _provider;
  }
}