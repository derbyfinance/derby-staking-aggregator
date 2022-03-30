// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IRouter {
  struct ProtocolInfoS {
    address LPToken;
    address provider;
    address underlying;
    address govToken;
    uint256 uScale;
  }
  
  function deposit(
    uint256 _ETFnumber,
    uint256 protocolNumber, 
    address buyer, 
    uint256 amount
  ) 
    external returns(uint256);

  function withdraw(
    uint256 _ETFnumber,
    uint256 protocolNumber,
    address seller,
    uint256 balance
  ) 
    external returns(uint256);

  function exchangeRate(
    uint256 _ETFnumber,
    uint256 protocolNumber
  ) 
    external view returns(uint256);

  function balance(
    uint256 _ETFnumber,
    uint256 protocolNumber,
    address _address
  ) 
    external view returns(uint256);

  function balanceUnderlying(
    uint256 _ETFnumber,
    uint256 protocolNumber,
    address _address
  ) 
    external view returns(uint256);

  function calcShares(
    uint256 _ETFnumber,
    uint256 protocolNumber,
    uint256 _amount
  ) 
    external view returns(uint256);

  function claim(
    uint256 _ETFnumber,
    uint256 protocolNumber
  ) 
    external returns(bool);

  function addProtocol(
    string calldata name,
    uint256 _ETFnumber,
    address provider,
    address protocolLPToken,
    address underlying,
    address govToken,
    uint256 _uScale
  )
    external returns(uint256);

  function curve3Pool() external view returns(address);

  function uniswapRouter() external view returns(address);

  function uniswapFactory() external view returns(address);

  function uniswapPoolFee() external view returns(uint24);

  function curve3PoolFee() external view returns(uint256);

  function uniswapSwapFee() external view returns(uint256);

  function curveIndex(address _token) external view returns(int128);
    
  function getProtocolInfo(
    uint256 _ETFnumber,
    uint256 protocolNumber
  )
    external view returns(ProtocolInfoS memory);

  function latestProtocolId(uint256 _ETFnumber) external view returns(uint256);

  function addVault(address _vault) external;

  function addCurveIndex(address _token, int128 _index) external;

  function setUniswapRouter(address _uniswapRouter) external;

  function setUniswapFactory(address _uniswapFactory) external;

  function setUniswapPoolFee(uint24 _poolFee) external;

  function getProtocolBlacklist(uint256 _ETFnumber, uint256 _protocolNum) external view returns(bool);

  function setProtocolBlacklist(uint256 _ETFnumber, uint256 _protocolNum) external;

  function getGasPrice() external returns(uint256);

  function setGasPriceOracle(address _chainlinkGasPriceOracle) external;

  function setUniswapSwapFee(uint256 _swapFee) external;
}