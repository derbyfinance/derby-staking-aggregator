// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "./Interfaces/IProvider.sol";
import "hardhat/console.sol";

contract Router {
  mapping(uint256 => mapping(uint256 => address)) public protocol;
  mapping(address => bool) public vaultWhitelist;

  address public dao;

  constructor(address _dao) {
    dao = _dao;
  }

  // Modifier for only vault?
  modifier onlyDao {
    require(msg.sender == dao, "Router: only DAO");
    _;
  }

  modifier onlyVault {
    require(vaultWhitelist[msg.sender] == true, "Router: only Vault");
    _;
  }

  function deposit(
    uint256 _ETFnumber, 
    uint256 _protocolNumber, 
    address _buyer, 
    uint256 _amount
    ) 
    external onlyVault returns(uint256) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).deposit(_buyer, _amount);
  }

  function withdraw(
    uint256 _ETFnumber, 
    uint256 _protocolNumber, 
    address _seller, 
    uint256 _balance
    ) 
    external onlyVault returns(uint256) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).withdraw(_seller, _balance);
  }

  function exchangeRate(
    uint256 _ETFnumber, 
    uint256 _protocolNumber
    ) 
    external onlyVault view returns(uint256) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).exchangeRate();
  }

  function addProtocol(
    uint256 _ETFnumber, 
    uint256 _protocolNumber, 
    address _provider,
    address _vault
    ) 
    external onlyDao { 
      protocol[_ETFnumber][_protocolNumber] = _provider;
      vaultWhitelist[_vault] = true;
  }
}