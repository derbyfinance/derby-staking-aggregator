// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

interface IRouter {
  function deposit(
    uint256 ETFnumber, 
    uint256 protocolNumber, 
    address buyer, 
    uint256 amount
    ) 
    external returns(uint256);

  function withdraw(
    uint256 ETFnumber,
    uint256 protocolNumber,
    address seller,
    uint256 balance
    ) 
    external;

  function exchangeRate(
    uint256 ETFnumber, 
    uint256 protocolNumber
    ) 
    external view returns(uint256);

  function addProtocol(
    uint256 ETFNumber,
    uint256 protocolNumber,
    address provider,
    address vault
  )
  external;
}