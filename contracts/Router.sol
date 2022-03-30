// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IProvider.sol";
import "./Interfaces/IRouter.sol";
import "./Interfaces/ExternalInterfaces/IChainlinkGasPrice.sol";
import "hardhat/console.sol";

contract Router is IRouter {
  mapping(uint256 => mapping(uint256 => ProtocolInfoS)) public protocolInfo;
  mapping(uint256 => mapping(uint256 => string)) public protocolNames;

  mapping(address => bool) public vaultWhitelist;
  mapping(address => bool) public claimable;

  mapping(uint256 => mapping(uint256 => bool)) public protocolBlacklist;
  mapping(uint256 => uint256) public latestProtocolId;

  // curve index for stable coins
  mapping(address => int128) public curveIndex;

  address public dao;
  address public curve3Pool;
  address public uniswapRouter;
  address public uniswapFactory;
  address public chainlinkGasPriceOracle;

  uint24 public uniswapPoolFee;
  uint256 public curve3PoolFee = 6; // 0.06%
  uint256 public uniswapSwapFee = 60; // 0.6% // 0.3 plus some slippage

  event SetProtocolNumber(uint256 protocolNumber, address protocol);

  constructor(
    address _dao, 
    address _curve3Pool, 
    address _uniswapRouter,
    address _uniswapFactory,
    uint24 _poolFee,
    address _chainlinkGasPriceOracle
  ) {
    dao = _dao;
    curve3Pool = _curve3Pool;
    uniswapRouter = _uniswapRouter;
    uniswapFactory = _uniswapFactory;
    uniswapPoolFee = _poolFee;
    chainlinkGasPriceOracle = _chainlinkGasPriceOracle;
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
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNumber Protocol number linked to protocol vault (number)
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to deposit
  /// @return Deposit function for requested protocol
  function deposit(
    uint256 _ETFnumber,
    uint256 _protocolNumber, 
    address _vault, 
    uint256 _amount
  ) external override onlyVault returns(uint256) {
      return IProvider(protocolInfo[_ETFnumber][_protocolNumber].provider)
              .deposit(
                _vault, 
                _amount, 
                protocolInfo[_ETFnumber][_protocolNumber].LPToken, 
                protocolInfo[_ETFnumber][_protocolNumber].underlying
              );
  }

  /// @notice Withdraw the underlying asset in given protocol number
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _vault Address from ETFVault contract i.e buyer
  /// @param _amount Amount to withdraw
  /// @return Withdraw function for requested protocol
  function withdraw(
    uint256 _ETFnumber,
    uint256 _protocolNumber, 
    address _vault, 
    uint256 _amount
  ) external override onlyVault returns(uint256) {
      return IProvider(protocolInfo[_ETFnumber][_protocolNumber].provider)
              .withdraw(
                _vault, 
                _amount, 
                protocolInfo[_ETFnumber][_protocolNumber].LPToken, 
                protocolInfo[_ETFnumber][_protocolNumber].underlying
              );
  }

  /// @notice Exchange rate of underyling protocol token
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @return ExchangeRate function for requested protocol
  function exchangeRate(
    uint256 _ETFnumber,
    uint256 _protocolNumber
  ) external override onlyVault view returns(uint256) {
      return IProvider(protocolInfo[_ETFnumber][_protocolNumber].provider)
              .exchangeRate(protocolInfo[_ETFnumber][_protocolNumber].LPToken);
  }

  /// @notice Balance of  underlying Token from address
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _address Address to request balance from
  /// @return Balance function for requested protocol
  function balance(
    uint256 _ETFnumber,
    uint256 _protocolNumber,
    address _address
  ) external override onlyVault view returns(uint256) {
      return IProvider(protocolInfo[_ETFnumber][_protocolNumber].provider)
              .balance(
                _address, 
                protocolInfo[_ETFnumber][_protocolNumber].LPToken
              );
  }

  /// @notice Get balance from address in shares i.e LP tokens
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _address Address to request balance from
  /// @return balanceUnderlying function for requested protocol
  function balanceUnderlying(
    uint256 _ETFnumber,
    uint256 _protocolNumber,
    address _address
  ) external override onlyVault view returns(uint256) {
      return IProvider(protocolInfo[_ETFnumber][_protocolNumber].provider)
              .balanceUnderlying(
                _address, 
                protocolInfo[_ETFnumber][_protocolNumber].LPToken
              );
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNumber Protocol number linked to protocol vault
  /// @param _amount Amount in underyling token e.g USDC
  /// @return calcShares function for requested protocol
  function calcShares(
    uint256 _ETFnumber,
    uint256 _protocolNumber,
    uint256 _amount
  ) external override onlyVault view returns(uint256) {
      return IProvider(protocolInfo[_ETFnumber][_protocolNumber].provider)
              .calcShares(
                _amount, 
                protocolInfo[_ETFnumber][_protocolNumber].LPToken
              );
  }

  /// @notice Harvest tokens from underlying protocols
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNumber Protocol number linked to protocol vault
  function claim(
    uint256 _ETFnumber,
    uint256 _protocolNumber
  ) external override onlyVault returns(bool) {
      if (claimable[protocolInfo[_ETFnumber][_protocolNumber].provider]) {
        return IProvider(protocolInfo[_ETFnumber][_protocolNumber].provider)
                .claim(protocolInfo[_ETFnumber][_protocolNumber].LPToken, msg.sender);
      } else {
        return false;
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
  /// @param _name Name of the protocol vault combination
  /// @param _ETFnumber Number of the ETF
  /// @param _provider Address of the protocol provider
  /// @param _protocolLPToken Address of protocolToken eg cUSDC
  /// @param _underlying Address of underlying protocol vault eg USDC
  /// @param _govToken Address of underlying protocol vault eg USDC
  function addProtocol(
    string calldata _name,
    uint256 _ETFnumber,
    address _provider,
    address _protocolLPToken,
    address _underlying,
    address _govToken,
    uint256 _uScale
  ) external onlyDao returns(uint256) {
    uint256 protocolNumber = latestProtocolId[_ETFnumber];

    protocolNames[_ETFnumber][protocolNumber] = _name;
    protocolInfo[_ETFnumber][protocolNumber] = ProtocolInfoS(
      _protocolLPToken,
      _provider,
      _underlying,
      _govToken,
      _uScale
    );

    emit SetProtocolNumber(protocolNumber, _protocolLPToken);

    latestProtocolId[_ETFnumber]++;

    return protocolNumber;
  }

  /// @notice Add protocol and vault to router
  /// @param _vault ETFVault address to whitelist
  function addVault(address _vault) external onlyDao {
    vaultWhitelist[_vault] = true;
  }

  /// @notice Set the Uniswap Router address
  /// @param _uniswapRouter New Uniswap Router address
  function setUniswapRouter(address _uniswapRouter) external onlyDao {
    uniswapRouter = _uniswapRouter;
  }

  /// @notice Set the Uniswap Factory address
  /// @param _uniswapFactory New Uniswap Factory address
  function setUniswapFactory(address _uniswapFactory) external onlyDao {
    uniswapFactory = _uniswapFactory;
  }

  /// @notice Set the Uniswap Pool fee
  /// @param _poolFee New Pool fee
  function setUniswapPoolFee(uint24 _poolFee) external onlyDao {
    uniswapPoolFee = _poolFee;
  }

  /// @notice Set the Curve3Pool fee
  /// @param _poolFee New Pool fee
  function setCurvePoolFee(uint24 _poolFee) external onlyDao {
    curve3PoolFee = _poolFee;
  }

  /// @notice Set curve pool index for underlying token
  /// @param _token Address of Token
  /// @param _index Curve index as decribed in Swap pool
  function addCurveIndex(address _token, int128 _index) external onlyDao {
    curveIndex[_token] = _index;
  }

  /// @notice Getter for protocol blacklist, given an ETFnumber and protocol number returns true if blacklisted. Can only be called by vault.
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNum Protocol number linked to protocol vault
  function getProtocolBlacklist(uint256 _ETFnumber, uint256 _protocolNum) external override onlyVault view returns(bool) {
    return protocolBlacklist[_ETFnumber][_protocolNum];
  }

  /// @notice Getter for the ProtocolInfo struct
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNum Protocol number linked to protocol vault
  function getProtocolInfo(uint256 _ETFnumber, uint256 _protocolNum) external override view returns(ProtocolInfoS memory) {
    return protocolInfo[_ETFnumber][_protocolNum];
  }

  /// @notice Setter for protocol blacklist, given an ETFnumber and protocol number puts the protocol on the blacklist. Can only be called by vault.
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNum Protocol number linked to protocol vault
  function setProtocolBlacklist(uint256 _ETFnumber, uint256 _protocolNum) external override onlyVault {
    protocolBlacklist[_ETFnumber][_protocolNum] = true;
  }

  /// @notice Gets the gas price from Chainlink oracle
  /// @return gasPrice latest gas price from oracle
  function getGasPrice() external override returns(uint256) {
    return IChainlinkGasPrice(chainlinkGasPriceOracle).latestAnswer();
  }

  /// @notice Setter for the Chainlink Gas price oracle contract address in case it changes
  /// @param _chainlinkGasPriceOracle Contract address
  function setGasPriceOracle(address _chainlinkGasPriceOracle) external override onlyDao {
    chainlinkGasPriceOracle = _chainlinkGasPriceOracle;
  }

  /// @notice Setter for the Uniswap swap fee plus some slippage
  /// @param _swapFee In nominals e.g 60 = 0.06%
  function setUniswapSwapFee(uint256 _swapFee) external override onlyDao {
    uniswapSwapFee = _swapFee;
  }
}