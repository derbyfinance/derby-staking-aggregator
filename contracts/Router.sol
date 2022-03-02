// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IProvider.sol";
import "hardhat/console.sol";

contract Router {
  // ETF Number => Protocol number => Protocol address
  mapping(uint256 => mapping(uint256 => address)) public protocol;
  
  mapping(address => bool) public vaultWhitelist;

  mapping(uint256 => bytes32) public protocolNames;
  uint256 public latestProtocolId;

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

  /// @notice Deposit the underlying asset in given protocol number
  /// @param _ETFnumber Number of the ETFVault
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to deposit
  /// @return Deposit function for requested protocol
  function deposit(
    uint256 _ETFnumber, 
    uint256 _protocolNumber, 
    address _vault, 
    uint256 _amount
    ) 
    external onlyVault returns(uint256) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).deposit(_vault, _amount);
  }

  /// @notice Withdraw the underlying asset in given protocol number
  /// @param _ETFnumber Number of the ETFVault
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to withdraw
  /// @return Withdraw function for requested protocol
  function withdraw(
    uint256 _ETFnumber, 
    uint256 _protocolNumber, 
    address _vault, 
    uint256 _amount
    ) 
    external onlyVault returns(uint256) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).withdraw(_vault, _amount);
  }

  /// @notice Exchange rate of underyling protocol token
  /// @param _ETFnumber Number of the ETFVault
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @return ExchangeRate function for requested protocol
  function exchangeRate(
    uint256 _ETFnumber, 
    uint256 _protocolNumber
    ) 
    external onlyVault view returns(uint256) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).exchangeRate();
  }

  /// @notice Balance of  underlying Token from address
  /// @param _ETFnumber Number of the ETFVault
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _address Address to request balance from
  /// @return Balance function for requested protocol
  function balance(
    uint256 _ETFnumber, 
    uint256 _protocolNumber,
    address _address
    ) 
    external onlyVault view returns(uint256) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).balance(_address);
  }

  /// @notice Get balance from address in shares i.e LP tokens
  /// @param _ETFnumber Number of the ETFVault
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _address Address to request balance from
  /// @return balanceUnderlying function for requested protocol
  function balanceUnderlying(
    uint256 _ETFnumber, 
    uint256 _protocolNumber,
    address _address
    ) 
    external onlyVault view returns(uint256) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).balanceUnderlying(_address);
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @param _ETFnumber Number of the ETFVault
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _amount Amount in underyling token e.g USDC
  /// @return calcShares function for requested protocol
  function calcShares(
    uint256 _ETFnumber, 
    uint256 _protocolNumber,
    uint256 _amount
    ) 
    external onlyVault view returns(uint256) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).calcShares(_amount);
  }

  /// @notice Get underlying token address from protocol e.g USDC
  /// @param _ETFnumber Number of the ETFVault
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @return Token address function for requested protocol
  function getProtocolTokenAddress(
    uint256 _ETFnumber, 
    uint256 _protocolNumber
    ) 
    external onlyVault view returns(address) {
      return IProvider(protocol[_ETFnumber][_protocolNumber]).protocolToken();
  }

  /// @notice Add protocol and vault to router
  /// @param _ETFnumber Number of the ETFVault
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _provider Provider contract
  /// @param _vault ETFVault address to whitelist
  function addProtocol(
    uint256 _ETFnumber, 
    uint256 _protocolNumber, 
    address _provider,
    address _vault
    ) 
    external onlyDao { 
      protocol[_ETFnumber][_protocolNumber] = _provider;
      latestProtocolId = _protocolNumber;
      vaultWhitelist[_vault] = true;
  }
}