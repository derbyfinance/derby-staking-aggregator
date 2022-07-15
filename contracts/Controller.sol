// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Interfaces/IProvider.sol";
import "./Interfaces/IController.sol";
import "./Interfaces/ExternalInterfaces/IChainlinkGasPrice.sol";
import "hardhat/console.sol";

contract Controller is IController {
  mapping(uint256 => mapping(uint256 => ProtocolInfoS)) public protocolInfo;  // first index is ETFNumber, second index is protocolNumber
  mapping(uint256 => mapping(uint256 => string)) public protocolNames;

  mapping(address => bool) public vaultWhitelist;
  mapping(address => bool) public claimable;

  mapping(uint256 => mapping(uint256 => bool)) public protocolBlacklist;
  mapping(uint256 => uint256) public latestProtocolId;

  // curve index for stable coins
  mapping(address => int128) public curveIndex;

  // uScale for vault currency coins (i.e. stables) used for swapping
  mapping(address => uint256) public underlyingUScale; // index is address of vaultcurrency erc20 contract

  address public dao;
  address public game;
  address public curve3Pool;
  address public uniswapRouter;
  address public uniswapQuoter;
  address public chainlinkGasPriceOracle;

  uint24 public uniswapPoolFee;
  uint256 public curve3PoolFee = 10; // 0.1% including slippage

  event SetProtocolNumber(uint256 protocolNumber, address protocol);

  constructor(
    address _dao, 
    address _curve3Pool, 
    address _uniswapRouter,
    address _uniswapQuoter,
    uint24 _poolFee,
    address _chainlinkGasPriceOracle
  ) {
    dao = _dao;
    curve3Pool = _curve3Pool;
    uniswapRouter = _uniswapRouter;
    uniswapQuoter = _uniswapQuoter;
    uniswapPoolFee = _poolFee;
    chainlinkGasPriceOracle = _chainlinkGasPriceOracle;
    underlyingUScale[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = 1E6; // USDC
    underlyingUScale[0x6B175474E89094C44Da98b954EedeAC495271d0F] = 1E18; // DAI
    underlyingUScale[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 1E6; // USDT
  }

  // Modifier for only vault?
  modifier onlyDao {
    require(msg.sender == dao, "Controller: only DAO");
    _;
  }

  modifier onlyVault {
    require(vaultWhitelist[msg.sender] == true, "Controller: only Vault");
    _;
  }

  modifier onlyVaultOrGame {
    require(vaultWhitelist[msg.sender] == true || msg.sender == game, "Controller: only Vault or Game");
    _;
  }

  /// @notice Deposit the underlying asset in given protocol number
  /// @param _ETFnumber Number of the ETF
  /// @param _protocolNumber Protocol number linked to protocol vault (number)
  /// @param _vault Address from Vault contract i.e buyer
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
  /// @param _vault Address from Vault contract i.e buyer
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
  ) external override onlyVaultOrGame view returns(uint256) {
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

  /// @notice Add protocol and vault to Controller
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

  /// @notice Add protocol and vault to Controller
  /// @param _vault Vault address to whitelist
  function addVault(address _vault) external onlyDao {
    vaultWhitelist[_vault] = true;
  }

  /// @notice Add game address to Controller
  /// @param _game game address
  function addGame(address _game) external onlyDao {
    game = _game;
  }

  /// @notice Set the Uniswap Router address
  /// @param _uniswapRouter New Uniswap Router address
  function setUniswapRouter(address _uniswapRouter) external onlyDao {
    uniswapRouter = _uniswapRouter;
  }

  /// @notice Set the Uniswap Factory address
  /// @param _uniswapQuoter New Uniswap Quoter address
  function setUniswapQuoter(address _uniswapQuoter) external onlyDao {
    uniswapQuoter = _uniswapQuoter;
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

  function addUnderlyingUScale(address _stable, uint256 _uScale) external onlyDao {
    underlyingUScale[_stable] = _uScale;
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
}