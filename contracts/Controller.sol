// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "./Interfaces/IProvider.sol";
import "./Interfaces/IController.sol";
import "./Interfaces/ExternalInterfaces/IChainlinkGasPrice.sol";
import "hardhat/console.sol";

contract Controller is IController {
  UniswapParams public uniswapParams;

  address private dao;
  address public curve3Pool;
  address public chainlinkGasPriceOracle;

  uint256 public curve3PoolFee = 15; // 0.15% including slippage

  // (vaultNumber => protocolNumber => protocolInfoStruct): struct in IController
  mapping(uint256 => mapping(uint256 => ProtocolInfoS)) public protocolInfo;
  // (vaultNumber => protocolNumber => protocolName): name of underlying protocol vaults
  mapping(uint256 => mapping(uint256 => string)) public protocolNames;

  // (vaultAddress => bool): true when address is whitelisted
  mapping(address => bool) public vaultWhitelist;
  // (vaultAddress => bool): true when protocol has claimable tokens / extra rewards
  mapping(address => bool) public claimable;

  // (vaultNumber => protocolNumber => bool): true when protocol is blacklisted
  mapping(uint256 => mapping(uint256 => bool)) public protocolBlacklist;
  // (vaultNumber => protocolNumber => address): address of the governance token
  mapping(uint256 => mapping(uint256 => address)) public protocolGovToken;
  // (vaultNumber => latestProtocolId)
  mapping(uint256 => uint256) public latestProtocolId;

  // (stableCoinAddress => curveIndex): curve index for stable coins
  mapping(address => int128) public curveIndex;
  // (stableCoinAddress => uScale): uScale for vault currency coins (i.e. stables) used for swapping
  mapping(address => uint256) public underlyingUScale; // index is address of vaultcurrency erc20 contract

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
    uniswapParams.router = _uniswapRouter;
    uniswapParams.quoter = _uniswapQuoter;
    uniswapParams.poolFee = _poolFee;
    chainlinkGasPriceOracle = _chainlinkGasPriceOracle;
    underlyingUScale[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = 1E6; // USDC
    underlyingUScale[0x6B175474E89094C44Da98b954EedeAC495271d0F] = 1E18; // DAI
    underlyingUScale[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 1E6; // USDT
  }

  // Modifier for only vault?
  modifier onlyDao() {
    require(msg.sender == dao, "Controller: only DAO");
    _;
  }

  modifier onlyVault() {
    require(vaultWhitelist[msg.sender] == true, "Controller: only Vault");
    _;
  }

  /// @notice Harvest tokens from underlying protocols
  /// @param _vaultNumber Number of the vault
  /// @param _protocolNumber Protocol number linked to protocol vault
  function claim(uint256 _vaultNumber, uint256 _protocolNumber)
    external
    override
    onlyVault
    returns (bool)
  {
    if (claimable[protocolInfo[_vaultNumber][_protocolNumber].provider]) {
      return
        IProvider(protocolInfo[_vaultNumber][_protocolNumber].provider).claim(
          protocolInfo[_vaultNumber][_protocolNumber].LPToken,
          msg.sender
        );
    } else {
      return false;
    }
  }

  function getUniswapParams() external view returns (UniswapParams memory) {
    return uniswapParams;
  }

  function getUniswapPoolFee() external view returns (uint24) {
    return uniswapParams.poolFee;
  }

  function getUniswapQuoter() external view returns (address) {
    return uniswapParams.quoter;
  }

  function getCurveParams(address _in, address _out) external view returns (CurveParams memory) {
    CurveParams memory curveParams;
    curveParams.indexTokenIn = curveIndex[_in];
    curveParams.indexTokenOut = curveIndex[_out];
    curveParams.pool = curve3Pool;
    curveParams.poolFee = curve3PoolFee;

    return curveParams;
  }

  /// @notice Getter for protocol blacklist, given an vaultnumber and protocol number returns true if blacklisted. Can only be called by vault.
  /// @param _vaultNumber Number of the vault
  /// @param _protocolNum Protocol number linked to protocol vault
  function getProtocolBlacklist(uint256 _vaultNumber, uint256 _protocolNum)
    external
    view
    override
    onlyVault
    returns (bool)
  {
    return protocolBlacklist[_vaultNumber][_protocolNum];
  }

  /// @notice Getter for the ProtocolInfo struct
  /// @param _vaultNumber Number of the vault
  /// @param _protocolNum Protocol number linked to protocol vault
  function getProtocolInfo(uint256 _vaultNumber, uint256 _protocolNum)
    external
    view
    override
    returns (ProtocolInfoS memory)
  {
    return protocolInfo[_vaultNumber][_protocolNum];
  }

  /// @notice Setter for protocol blacklist, given an vaultnumber and protocol number puts the protocol on the blacklist. Can only be called by vault.
  /// @param _vaultNumber Number of the vault
  /// @param _protocolNum Protocol number linked to protocol vault
  function setProtocolBlacklist(uint256 _vaultNumber, uint256 _protocolNum)
    external
    override
    onlyVault
  {
    protocolBlacklist[_vaultNumber][_protocolNum] = true;
  }

  /// @notice Gets the gas price from Chainlink oracle
  /// @return gasPrice latest gas price from oracle
  function getGasPrice() external override returns (uint256) {
    return IChainlinkGasPrice(chainlinkGasPriceOracle).latestAnswer();
  }

  /// @notice Gets the gas price from Chainlink oracle
  /// @return gasPrice latest gas price from oracle
  function getGovToken(uint256 _vaultNumber, uint256 _protocolNum) external view returns (address) {
    return protocolGovToken[_vaultNumber][_protocolNum];
  }

  /// @notice Getter for dao address
  function getDao() public view returns (address) {
    return dao;
  }

  /*
  Only Dao functions
  */

  /// @notice Add protocol and vault to Controller
  /// @param _name Name of the protocol vault combination
  /// @param _vaultNumber Number of the vault
  /// @param _provider Address of the protocol provider
  /// @param _protocolLPToken Address of protocolToken eg cUSDC
  /// @param _underlying Address of underlying protocol vault eg USDC
  /// @param _govToken Address governance token of the protocol
  function addProtocol(
    string calldata _name,
    uint256 _vaultNumber,
    address _provider,
    address _protocolLPToken,
    address _underlying,
    address _govToken,
    uint256 _uScale
  ) external onlyDao returns (uint256) {
    uint256 protocolNumber = latestProtocolId[_vaultNumber];

    protocolNames[_vaultNumber][protocolNumber] = _name;
    protocolGovToken[_vaultNumber][protocolNumber] = _govToken;
    protocolInfo[_vaultNumber][protocolNumber] = ProtocolInfoS(
      _protocolLPToken,
      _provider,
      _underlying,
      _uScale
    );

    emit SetProtocolNumber(protocolNumber, _protocolLPToken);

    latestProtocolId[_vaultNumber]++;

    return protocolNumber;
  }

  /// @notice Add protocol and vault to Controller
  /// @param _vault Vault address to whitelist
  function addVault(address _vault) external onlyDao {
    vaultWhitelist[_vault] = true;
  }

  /// @notice Set the Uniswap Router address
  /// @param _uniswapRouter New Uniswap Router address
  function setUniswapRouter(address _uniswapRouter) external onlyDao {
    uniswapParams.router = _uniswapRouter;
  }

  /// @notice Set the Uniswap Factory address
  /// @param _uniswapQuoter New Uniswap Quoter address
  function setUniswapQuoter(address _uniswapQuoter) external onlyDao {
    uniswapParams.quoter = _uniswapQuoter;
  }

  /// @notice Set the Uniswap Pool fee
  /// @param _poolFee New Pool fee
  function setUniswapPoolFee(uint24 _poolFee) external onlyDao {
    uniswapParams.poolFee = _poolFee;
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

  /// @notice Setter for the Chainlink Gas price oracle contract address in case it changes
  /// @param _chainlinkGasPriceOracle Contract address
  function setGasPriceOracle(address _chainlinkGasPriceOracle) external override onlyDao {
    chainlinkGasPriceOracle = _chainlinkGasPriceOracle;
  }

  /// @notice Set if provider have claimable tokens
  /// @param _provider Address of the underlying protocol
  /// @param _bool True of the underlying protocol has claimable tokens
  function setClaimable(address _provider, bool _bool) external onlyDao {
    claimable[_provider] = _bool;
  }

  /// @notice Setter for DAO address
  /// @param _dao DAO address
  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }
}
