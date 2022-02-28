// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

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

  function exchangeRate(
    uint256 ETFnumber, 
    uint256 protocolNumber,
    address _address
  ) 
    external view returns(uint256);

  function balance(
    uint256 ETFnumber, 
    uint256 protocolNumber,
    address _address
  ) 
    external view returns(uint256);

  function balanceUnderlying(
    uint256 ETFnumber, 
    uint256 protocolNumber,
    address _address
  ) 
    external view returns(uint256);

  function calcShares(
    uint256 ETFnumber, 
    uint256 protocolNumber,
    uint256 _amount
  ) 
    external view returns(uint256);

  function addProtocol(
    uint256 ETFNumber,
    uint256 protocolNumber,
    address provider,
    address vault
  )
    external;

  function addProtocol(
    address provider
  )
    external;

  function protocol(
    uint256 ETFNumber,
    uint256 protocolNumber
  )
    external view returns(address);

  function latestProtocolId() external view returns(uint256);

  function getProtocolTokenAddress(
    uint256 ETFNumber,
    uint256 protocolNumber
  )
    external view returns(address);
}