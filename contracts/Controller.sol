// SPDX-License-Identifier: MIT
// Derby Finance - 2022
// bla
pragma solidity ^0.8.11;

import "./Interfaces/IProvider.sol";
import "./Interfaces/IController.sol";

contract Controller is IController {
  UniswapParams public uniswapParams;

  address private dao;

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
  // LPtoken => bool: already added protocols
  mapping(address => bool) private addedProtocols;

  event SetProtocolNumber(uint256 protocolNumber, address protocol);

  constructor(address _dao) {
    dao = _dao;
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
  function claim(
    uint256 _vaultNumber,
    uint256 _protocolNumber
  ) external override onlyVault returns (bool) {
    if (claimable[protocolInfo[_vaultNumber][_protocolNumber].LPToken]) {
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

  /// @notice Getter for protocol blacklist, given an vaultnumber and protocol number returns true if blacklisted. Can only be called by vault.
  /// @param _vaultNumber Number of the vault
  /// @param _protocolNum Protocol number linked to protocol vault
  function getProtocolBlacklist(
    uint256 _vaultNumber,
    uint256 _protocolNum
  ) external view override onlyVault returns (bool) {
    return protocolBlacklist[_vaultNumber][_protocolNum];
  }

  /// @notice Getter for the ProtocolInfo struct
  /// @param _vaultNumber Number of the vault
  /// @param _protocolNum Protocol number linked to protocol vault
  function getProtocolInfo(
    uint256 _vaultNumber,
    uint256 _protocolNum
  ) external view override returns (ProtocolInfoS memory) {
    return protocolInfo[_vaultNumber][_protocolNum];
  }

  /// @notice Setter for protocol blacklist, given an vaultnumber and protocol number puts the protocol on the blacklist. Can only be called by vault.
  /// @param _vaultNumber Number of the vault
  /// @param _protocolNum Protocol number linked to protocol vault
  function setProtocolBlacklist(
    uint256 _vaultNumber,
    uint256 _protocolNum
  ) external override onlyVault {
    protocolBlacklist[_vaultNumber][_protocolNum] = true;
  }

  /// @notice Getter for the gov token address
  /// @param _vaultNumber Number of the vault
  /// @param _protocolNum Protocol number linked to protocol vault
  /// @return Protocol gov token address
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
    address _govToken
  ) external onlyDao returns (uint256) {
    require(!addedProtocols[_protocolLPToken], "Protocol already added");
    uint256 protocolNumber = latestProtocolId[_vaultNumber];

    protocolNames[_vaultNumber][protocolNumber] = _name;
    protocolGovToken[_vaultNumber][protocolNumber] = _govToken;
    protocolInfo[_vaultNumber][protocolNumber] = ProtocolInfoS(
      _protocolLPToken,
      _provider,
      _underlying
    );

    addedProtocols[_protocolLPToken] = true;
    emit SetProtocolNumber(protocolNumber, _protocolLPToken);

    latestProtocolId[_vaultNumber]++;

    return protocolNumber;
  }

  /// @notice Sets the protocol information for a specific vault and protocol number in case something goes wrong.
  /// @dev Stores the protocol information in the protocolInfo mapping.
  /// @param _vaultNumber The vault number to associate the protocol information with.
  /// @param _protocolNumber The protocol number to associate the protocol information with.
  /// @param _LPToken The address of the liquidity provider token for the protocol.
  /// @param _provider The address of the provider for the protocol.
  /// @param _underlying The address of the underlying token for the protocol.
  function setProtocolInfo(
    uint256 _vaultNumber,
    uint256 _protocolNumber,
    address _LPToken,
    address _provider,
    address _underlying
  ) external onlyDao {
    protocolInfo[_vaultNumber][_protocolNumber] = ProtocolInfoS({
      LPToken: _LPToken,
      provider: _provider,
      underlying: _underlying
    });
  }

  /// @notice Set the whitelist status of a vault in the Controller
  /// @param _vault Vault address to update
  /// @param _status Boolean value representing the new whitelist status of the vault
  function setVaultWhitelistStatus(address _vault, bool _status) external onlyDao {
    vaultWhitelist[_vault] = _status;
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

  /// @notice Set if provider have claimable tokens
  /// @param _LPToken Address of the underlying protocol vault
  /// @param _bool True of the underlying protocol has claimable tokens
  function setClaimable(address _LPToken, bool _bool) external onlyDao {
    claimable[_LPToken] = _bool;
  }

  /// @notice Setter for DAO address
  /// @param _dao DAO address
  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }
}
