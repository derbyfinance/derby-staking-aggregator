// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IProvider.sol";
import "hardhat/console.sol";

contract Router {
  mapping(uint256 => address) public protocolLPToken;
  mapping(uint256 => address) public protocolProvider;
  mapping(uint256 => address) public protocolUnderlying;
  mapping(uint256 => address) public protocolGovToken;

  mapping(address => bool) public vaultWhitelist;
  mapping(address => bool) public claimable;

  mapping(uint256 => bytes32) public protocolNames;
  uint256 public latestProtocolId = 0;

  event SetProtocolNumber(uint256 protocolNumber, address protocol);

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
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to deposit
  /// @return Deposit function for requested protocol
  function deposit(
    uint256 _protocolNumber, 
    address _vault, 
    uint256 _amount
  ) external onlyVault returns(uint256) {
      return IProvider(protocolProvider[_protocolNumber])
              .deposit(_vault, _amount, protocolLPToken[_protocolNumber], protocolUnderlying[_protocolNumber]);
  }

  /// @notice Withdraw the underlying asset in given protocol number
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to withdraw
  /// @return Withdraw function for requested protocol
  function withdraw(
    uint256 _protocolNumber, 
    address _vault, 
    uint256 _amount
  ) external onlyVault returns(uint256) {
      return IProvider(protocolProvider[_protocolNumber])
              .withdraw(_vault, _amount, protocolLPToken[_protocolNumber], protocolUnderlying[_protocolNumber]);
  }

  /// @notice Exchange rate of underyling protocol token
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @return ExchangeRate function for requested protocol
  function exchangeRate(
    uint256 _protocolNumber
  ) external onlyVault view returns(uint256) {
      return IProvider(protocolProvider[_protocolNumber])
              .exchangeRate(protocolLPToken[_protocolNumber]);
  }

  /// @notice Balance of  underlying Token from address
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _address Address to request balance from
  /// @return Balance function for requested protocol
  function balance(
    uint256 _protocolNumber,
    address _address
  ) external onlyVault view returns(uint256) {
      return IProvider(protocolProvider[_protocolNumber])
              .balance(_address, protocolLPToken[_protocolNumber]);
  }

  /// @notice Get balance from address in shares i.e LP tokens
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _address Address to request balance from
  /// @return balanceUnderlying function for requested protocol
  function balanceUnderlying(
    uint256 _protocolNumber,
    address _address
  ) external onlyVault view returns(uint256) {
      return IProvider(protocolProvider[_protocolNumber])
              .balanceUnderlying(_address, protocolLPToken[_protocolNumber]);
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _amount Amount in underyling token e.g USDC
  /// @return calcShares function for requested protocol
  function calcShares(
    uint256 _protocolNumber,
    uint256 _amount
  ) external onlyVault view returns(uint256) {
      return IProvider(protocolProvider[_protocolNumber])
              .calcShares(_amount, protocolLPToken[_protocolNumber]);
  }

  /// @notice Harvest tokens from underlying protocols
  /// @param _protocolNumber Protocol number linked to protocol vault
  function claim(
    uint256 _protocolNumber
  ) external onlyVault {
      if (claimable[protocolProvider[_protocolNumber]]) {
        return IProvider(protocolProvider[_protocolNumber])
                .claim(protocolLPToken[_protocolNumber]);
      }
  }

  /// @notice Set if provider have claimable tokens
  /// @param _provider Address of the underlying protocol
  /// @param _bool True of the underlying protocol has claimable tokens
  function setClaimable(address _provider, bool _bool) 
    external onlyDao { 
      claimable[_provider] = _bool;
  }

  /// @notice Add protocol and vault to router
  /// @param _provider Address of the protocol provider
  /// @param _protocolLPToken Address of protocolToken eg cUSDC
  /// @param _underlying Address of underlying protocol vault eg USDC
  /// @param _govToken Address of underlying protocol vault eg USDC
  function addProtocol(
    address _provider,
    address _protocolLPToken,
    address _underlying,
    address _govToken
  ) external onlyDao returns(uint256) { 
      uint256 protocolNumber = latestProtocolId;

      protocolProvider[protocolNumber] = _provider;
      protocolLPToken[protocolNumber] = _protocolLPToken;
      protocolUnderlying[protocolNumber] = _underlying;
      protocolGovToken[protocolNumber] = _govToken;

      emit SetProtocolNumber(protocolNumber, _protocolLPToken);

      latestProtocolId++;

      return protocolNumber;
  }

  /// @notice Add protocol and vault to router
  /// @param _vault ETFVault address to whitelist
  function addVault( 
    address _vault
  ) external onlyDao {
      vaultWhitelist[_vault] = true;
  }
}