// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IRouter {
  function deposit(
    uint256 protocolNumber, 
    address buyer, 
    uint256 amount
  ) 
    external returns(uint256);

  function withdraw(
    uint256 protocolNumber,
    address seller,
    uint256 balance
  ) 
    external;

  function exchangeRate(
    uint256 protocolNumber
  ) 
    external view returns(uint256);

  function exchangeRate(
    uint256 protocolNumber,
    address _address
  ) 
    external view returns(uint256);

  function balance(
    uint256 protocolNumber,
    address _address
  ) 
    external view returns(uint256);

  function balanceUnderlying(
    uint256 protocolNumber,
    address _address
  ) 
    external view returns(uint256);

  function calcShares(
    uint256 protocolNumber,
    uint256 _amount
  ) 
    external view returns(uint256);

  function claim(
    uint256 protocolNumber
  ) 
    external returns(bool);

  function addProtocol(
    address provider,
    address protocolLPToken,
    address underlying,
    address govToken
  )
    external;

  function latestProtocolId() external view returns(uint256);

  function curve3Pool() external view returns(address);

  function uniswapRouter() external view returns(address);

  function uniswapFactory() external view returns(address);

  function uniswapPoolFee() external view returns(uint24);

  function protocolProvider(
    uint256 protocolNumber
  )
    external view returns(address);

  function protocolLPToken(
    uint256 protocolNumber
  )
    external view returns(address);
  
  function protocolGovToken(
    uint256 protocolNumber
  )
    external view returns(address);
}