// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IVault.sol";
import "./Interfaces/IXChainController.sol";
import "./Interfaces/IGame.sol";
import "./Interfaces/ExternalInterfaces/IConnext.sol";
import "./Interfaces/ExternalInterfaces/IXReceiver.sol";

contract XProvider is IXReceiver {
  using SafeERC20 for IERC20;

  address public immutable connext;

  address private dao;
  address private guardian;
  address public game;

  uint32 public homeChain;
  uint32 public gameChain;

  // Slippage tolerance and router fee for cross-chain swap, in BPS (i.e. 30 = 0.3%).
  uint256 public connextRouterFee;
  uint256 public slippage;

  // minimum ether value for cross chain messages through connext
  uint256 public minimumConnextFee;

  // (domainID => contract address) mapping domainIDs to trusted remote xProvider on that specific domain
  mapping(uint32 => address) public trustedRemoteConnext;
  // (vaultAddress => bool): used for whitelisting vaults
  mapping(address => bool) public vaultWhitelist;
  // (vaultNumber => vaultAddress): used for guardian when xCall fails
  mapping(uint256 => address) public vaults;

  string public etherNotUsed = "Ether sent not used";
  string public minValue = "Minimum msg value";

  event SetTrustedRemote(uint32 _srcChainId, bytes _srcAddress);
  event SetTrustedRemoteConnext(uint32 _srcChainId, address _srcAddress);

  modifier onlyDao() {
    require(msg.sender == dao, "xProvider: only DAO");
    _;
  }

  modifier onlyGuardian() {
    require(msg.sender == guardian, "only Guardian");
    _;
  }

  modifier onlyVaults() {
    require(vaultWhitelist[msg.sender], "xProvider: only vault");
    _;
  }

  modifier onlyGame() {
    require(msg.sender == game, "xProvider: only Game");
    _;
  }

  /// @notice Solution for the low-level call in xReceive that is seen as an external call
  modifier onlySelf() {
    require(msg.sender == address(this), "xProvider: only Self");
    _;
  }

  modifier onlySelfOrVault() {
    require(
      msg.sender == address(this) || vaultWhitelist[msg.sender],
      "xProvider: only Self or Vault"
    );
    _;
  }

  /** @notice A modifier for authenticated calls.
   * This is an important security consideration. If the target contract
   * function should be authenticated, it must check three things:
   *    1) The originating call comes from the expected origin domain.
   *    2) The originating call comes from the expected source contract.
   *    3) The call to this contract comes from Connext.
   */
  modifier onlySource(address _originSender, uint32 _origin) {
    require(
      trustedRemoteConnext[_origin] != address(0) &&
        _originSender == trustedRemoteConnext[_origin] &&
        msg.sender == connext,
      "Not trusted"
    );
    _;
  }

  constructor(address _connext, address _dao, address _guardian, address _game, uint32 _homeChain) {
    connext = _connext;
    dao = _dao;
    guardian = _guardian;
    game = _game;
    homeChain = _homeChain;
    connextRouterFee = 5; // 0.05%
    slippage = 50; // 0.5%
    minimumConnextFee = 0.03 ether;
  }

  /// @notice Transfers funds from one chain to another using the Connext contract.
  /// @dev The function first checks if the destination domain is trusted, then transfers
  ///      and approves the specified token (if any), and finally calls the Connext contract to
  ///      perform the cross-chain transfer.
  /// @param _destinationDomain The destination domain ID.
  /// @param _callData Additional data to be included in the cross-chain transfer.
  /// @param _asset Address of the token on this domain (use address(0) for non currency transfers).
  /// @param _amount The amount to transfer.
  function xSend(
    uint32 _destinationDomain,
    bytes memory _callData,
    address _asset,
    uint256 _amount
  ) internal {
    address target = trustedRemoteConnext[_destinationDomain];
    require(target != address(0), "XProvider: destination chain not trusted");

    if (_asset != address(0)) transferAndApprove(_asset, _amount);

    IConnext(connext).xcall{value: msg.value}(
      _destinationDomain, // _destination: Domain ID of the destination chain
      target, // _to: address receiving the funds on the destination
      _asset, // _asset: address of the token contract
      guardian, // _delegate: address that can revert or forceLocal on destination
      _amount, // _amount: amount of tokens to transfer
      slippage, // _slippage: the maximum amount of slippage the user will accept in BPS (e.g. 30 = 0.3%)
      _callData // _callData: empty bytes because we're only sending funds
    );
  }

  /// @notice Transfers the specified amount of tokens from the user to this contract,
  ///         and approves the transfer of the same amount to the Connext contract.
  /// @dev This function is called within the xSend function.
  /// @param _asset The address of the token to transfer and approve.
  /// @param _amount The amount of tokens to transfer and approve.
  function transferAndApprove(address _asset, uint256 _amount) internal {
    require(
      IERC20(_asset).allowance(msg.sender, address(this)) >= _amount,
      "User must approve amount"
    );
    // User sends funds to this contract
    IERC20(_asset).safeTransferFrom(msg.sender, address(this), _amount);
    // This contract approves transfer to Connext
    IERC20(_asset).safeIncreaseAllowance(address(connext), _amount);
  }

  /// @notice function implemented from IXReceive from connext, standard way to receive messages with connext.
  /// @param _transferId not used here because only relevant in case of a value transfer. Still in the signature to comply with IXReceive.
  /// @param _amount not used here because only relevant in case of a value transfer. Still in the signature to comply with IXReceive.
  /// @param _asset not used here because only relevant in case of a value transfer. Still in the signature to comply with IXReceive.
  /// @param _originSender sender contract.
  /// @param _origin sender domain id.
  /// @param _callData calldata, contains function signature which has to be called in this contract as well as the values, hashed and encoded.
  function xReceive(
    bytes32 _transferId,
    uint256 _amount,
    address _asset,
    address _originSender,
    uint32 _origin,
    bytes memory _callData
  ) external onlySource(_originSender, _origin) returns (bytes memory) {
    (bool success, ) = address(this).call(_callData);
    require(success, "xReceive: No success");
  }

  /// @notice Step 7 push; Game pushes deltaAllocations to vaults
  /// @notice Push protocol allocation array from the game to all vaults/chains
  /// @param _vault Address of the vault on given chainId
  /// @param _deltas Array with delta allocations where the index matches the protocolId
  function pushProtocolAllocationsToVault(
    uint32 _chainId,
    address _vault,
    int256[] memory _deltas
  ) external payable onlyGame {
    if (_chainId == homeChain) {
      require(msg.value == 0, etherNotUsed);
      return IVault(_vault).receiveProtocolAllocations(_deltas);
    } else {
      require(msg.value >= minimumConnextFee, minValue);
      bytes4 selector = bytes4(keccak256("receiveProtocolAllocationsToVault(address,int256[])"));
      bytes memory callData = abi.encodeWithSelector(selector, _vault, _deltas);

      xSend(_chainId, callData, address(0), 0);
    }
  }

  /// @notice Step 7 receive; Game pushes deltaAllocations to vaults
  /// @notice Receives protocol allocation array from the game to all vaults/chains
  /// @param _vault Address of the vault on given chainId
  /// @param _deltas Array with delta allocations where the index matches the protocolId
  function receiveProtocolAllocationsToVault(
    address _vault,
    int256[] memory _deltas
  ) external onlySelf {
    return IVault(_vault).receiveProtocolAllocations(_deltas);
  }

  /// @notice Step 9 push; Vaults push rewardsPerLockedToken to game
  /// @notice Push price and rewards array from vaults to the game
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _rewards Array with rewardsPerLockedToken of all protocols in vault => index matches protocolId
  function pushRewardsToGame(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) external payable onlyVaults {
    if (homeChain == gameChain) {
      require(msg.value == 0, etherNotUsed);
      return IGame(game).settleRewards(_vaultNumber, _chainId, _rewards);
    } else {
      require(msg.value >= minimumConnextFee, minValue);
      bytes4 selector = bytes4(keccak256("receiveRewardsToGame(uint256,uint32,int256[])"));
      bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _chainId, _rewards);

      xSend(gameChain, callData, address(0), 0);
    }
  }

  /// @notice Step 9 receive; Vaults push rewardsPerLockedToken to game
  /// @notice Receives price and rewards array from vaults to the game
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _rewards Array with rewardsPerLockedToken of all protocols in vault => index matches protocolId
  function receiveRewardsToGame(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) external onlySelf {
    return IGame(game).settleRewards(_vaultNumber, _chainId, _rewards);
  }

  /// @notice Getter for dao address
  function getDao() public view returns (address) {
    return dao;
  }

  /*
  Only Dao functions
  */
  /// @notice set trusted provider on remote chains, allow owner to set it multiple times.
  /// @param _srcChainId Chain is for remote xprovider, some as the remote receiving contract chain id (xReceive)
  /// @param _srcAddress Address of remote xprovider
  function setTrustedRemoteConnext(uint32 _srcChainId, address _srcAddress) external onlyDao {
    trustedRemoteConnext[_srcChainId] = _srcAddress;
    emit SetTrustedRemoteConnext(_srcChainId, _srcAddress);
  }

  /// @notice Setter for homeChain Id
  /// @param _homeChain New home chainId
  function setHomeChain(uint32 _homeChain) external onlyDao {
    homeChain = _homeChain;
  }

  /// @notice Setter for gameChain Id
  /// @param _gameChain New chainId for game contract
  function setGameChainId(uint32 _gameChain) external onlyDao {
    gameChain = _gameChain;
  }

  /// @notice Whitelists vault address for onlyVault modifier
  function toggleVaultWhitelist(address _vault) external onlyDao {
    vaultWhitelist[_vault] = !vaultWhitelist[_vault];
  }

  /// @notice Setter for dao address
  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }

  /// @notice Setter for guardian address
  /// @param _guardian new address of the guardian
  function setGuardian(address _guardian) external onlyDao {
    guardian = _guardian;
  }

  /// @notice Setter for new game address
  /// @param _game New address of the game
  function setGame(address _game) external onlyDao {
    game = _game;
  }

  /// @notice Setter for vault address to vaultNumber for guardian
  function setVaultAddress(uint256 _vaultNumber, address _vault) external onlyDao {
    vaults[_vaultNumber] = _vault;
  }

  /*
  Only Guardian functions
  */

  /// @notice Sets the connextRouterFee variable.
  /// @param _connextRouterFee The new value for the connextRouterFee.
  function setConnextRouterFee(uint256 _connextRouterFee) external onlyGuardian {
    connextRouterFee = _connextRouterFee;
  }

  /// @notice Sets the slippage variable.
  /// @param _slippage The new value for the slippage.
  function setSlippage(uint256 _slippage) external onlyGuardian {
    slippage = _slippage;
  }

  /// @dev Sets the minimum ether value for cross chain messages through Connext.
  /// @param _newMinimumConnextFee The new minimum Connext fee in ether to be set.
  function setMinimumConnextFee(uint256 _newMinimumConnextFee) external onlyGuardian {
    minimumConnextFee = _newMinimumConnextFee;
  }
}
