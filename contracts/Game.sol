// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./DerbyToken.sol";

import "./Interfaces/IVault.sol";
import "./Interfaces/IXProvider.sol";

import "hardhat/console.sol";

contract Game is ERC721, ReentrancyGuard {
  using SafeERC20 for IERC20;

  struct Basket {
    // the vault number for which this Basket was created
    uint256 vaultNumber;
    // the chainId for which this Basket was created
    uint32 chainId;
    // last period when this Basket got rebalanced
    uint256 lastRebalancingPeriod;
    // nr of total allocated tokens
    int256 nrOfAllocatedTokens;
    // total build up rewards
    int256 totalUnRedeemedRewards; // In vaultCurrency.decimals() * BASE_SCALE of 1e18
    // total redeemed rewards
    int256 totalRedeemedRewards; // In vaultCurrency.decimals()
    // (protocolNumber => allocation)
    mapping(uint256 => int256) allocations;
  }

  struct vaultInfo {
    address vaultAddress;
    int256 deltaAllocationsVault;
    bool rewardsReceived;
    uint256 latestProtocolId;
    // (protocolNumber => deltaAllocation)
    mapping(uint256 => int256) deltaAllocationProtocol;
    // (rebalancing period => protocol id => rewardPerLockedToken).
    // in BASE_SCALE * vaultCurrency.decimals() nr of decimals (BASE_SCALE (same as DerbyToken.decimals()))
    mapping(uint256 => mapping(uint256 => int256)) rewardPerLockedToken;
  }

  address private dao;
  address private guardian;
  address public xProvider;

  IERC20 public derbyToken;

  // used in notInSameBlock modifier
  uint256 private lastBlock;

  // latest basket id
  uint256 private latestBasketId;

  // interval in Unix timeStamp
  uint256 public rebalanceInterval; // SHOULD BE REPLACED FOR REALISTIC NUMBER

  // last rebalance timeStamp
  mapping(uint256 => uint256) public lastTimeStamp;

  // threshold in vaultCurrency e.g USDC for when user tokens will be sold / burned. Must be negative
  int256 internal negativeRewardThreshold;
  // percentage of tokens that will be sold at negative rewards
  uint256 internal negativeRewardFactor;
  // vaultNumber => tokenPrice || price of vaultCurrency / derbyToken
  mapping(uint256 => uint256) public tokenPrice;

  // used to scale rewards
  uint256 public BASE_SCALE = 1e18;

  // vaultNumber => vaultAddress
  mapping(uint256 => address) public homeVault;

  // baskets, maps tokenID from BasketToken NFT contract to the Basket struct in this contract.
  // (basketTokenId => basket struct):
  mapping(uint256 => Basket) private baskets;

  // (chainId => vaultNumber => vaultInfo struct)
  mapping(uint32 => mapping(uint256 => vaultInfo)) internal vaults;

  event PushProtocolAllocations(uint32 chain, address vault, int256[] deltas);

  event BasketId(address owner, uint256 basketId);

  modifier onlyDao() {
    require(msg.sender == dao, "Game: only DAO");
    _;
  }

  modifier onlyBasketOwner(uint256 _basketId) {
    require(msg.sender == ownerOf(_basketId), "Game: Not the owner of the basket");
    _;
  }

  modifier onlyXProvider() {
    require(msg.sender == xProvider, "Game: only xProvider");
    _;
  }

  modifier onlyGuardian() {
    require(msg.sender == guardian, "Game: only Guardian");
    _;
  }

  modifier notInSameBlock() {
    require(block.number != lastBlock, "Cannot call functions in the same block");
    lastBlock = block.number;
    _;
  }

  constructor(
    string memory name_,
    string memory symbol_,
    address _derbyToken,
    address _dao,
    address _guardian
  ) ERC721(name_, symbol_) {
    derbyToken = IERC20(_derbyToken);
    dao = _dao;
    guardian = _guardian;
  }

  /// @notice Setter for delta allocation in a particulair chainId
  /// @param _chainId number of chainId
  /// @param _vaultNumber number of vault
  /// @param _deltaAllocationsVault delta allocation
  function addDeltaAllocationsVault(
    uint32 _chainId,
    uint256 _vaultNumber,
    int256 _deltaAllocationsVault
  ) internal {
    vaults[_chainId][_vaultNumber].deltaAllocationsVault += _deltaAllocationsVault;
  }

  /// @notice Getter for delta allocation in a particulair chainId
  /// @param _chainId number of chainId
  /// @param _vaultNumber number of vault
  /// @return allocation delta allocation
  function getDeltaAllocationsVault(
    uint32 _chainId,
    uint256 _vaultNumber
  ) public view returns (int256) {
    return vaults[_chainId][_vaultNumber].deltaAllocationsVault;
  }

  /// @notice Setter for the delta allocation in Protocol vault e.g compound_usdc_01
  /// @dev Allocation can be negative
  /// @param _chainId number of chainId
  /// @param _vaultNumber number of vault
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  /// @param _deltaAllocation Delta allocation in tokens
  function addDeltaAllocationsProtocol(
    uint32 _chainId,
    uint256 _vaultNumber,
    uint256 _protocolNum,
    int256 _deltaAllocation
  ) internal {
    vaults[_chainId][_vaultNumber].deltaAllocationProtocol[_protocolNum] += _deltaAllocation;
  }

  /// @notice Getter for the delta allocation in Protocol vault e.g compound_usdc_01
  /// @param _chainId number of chainId
  /// @param _vaultNumber number of vault
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  /// @return allocation Delta allocation in tokens
  function getDeltaAllocationsProtocol(
    uint32 _chainId,
    uint256 _vaultNumber,
    uint256 _protocolNum
  ) public view returns (int256) {
    return vaults[_chainId][_vaultNumber].deltaAllocationProtocol[_protocolNum];
  }

  /// @notice Setter to set the total number of allocated tokens. Only the owner of the basket can set this.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @param _allocation Number of derby tokens that are allocated towards protocols.
  function setBasketTotalAllocatedTokens(
    uint256 _basketId,
    int256 _allocation
  ) internal onlyBasketOwner(_basketId) {
    baskets[_basketId].nrOfAllocatedTokens += _allocation;
    require(basketTotalAllocatedTokens(_basketId) >= 0, "Basket: underflow");
  }

  /// @notice function to see the total number of allocated tokens. Only the owner of the basket can view this.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @return int256 Number of derby tokens that are allocated towards protocols.
  function basketTotalAllocatedTokens(uint256 _basketId) public view returns (int256) {
    return baskets[_basketId].nrOfAllocatedTokens;
  }

  /// @notice Setter to set the allocation of a specific protocol by a basketId. Only the owner of the basket can set this.
  /// @param _chainId Chain ID of the vault
  /// @param _vaultNumber Number of the vault
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @param _protocolId Id of the protocol of which the allocation is queried.
  /// @param _allocation Number of derby tokens that are allocated towards this specific protocol.
  function setBasketAllocationInProtocol(
    uint32 _chainId,
    uint256 _vaultNumber,
    uint256 _basketId,
    uint256 _protocolId,
    int256 _allocation
  ) internal onlyBasketOwner(_basketId) {
    baskets[_basketId].allocations[_protocolId] += _allocation;

    int256 currentAllocation = basketAllocationInProtocol(_basketId, _protocolId);
    require(currentAllocation >= 0, "Basket: underflow");

    int256 currentReward = getRewardsPerLockedToken(
      _chainId,
      _vaultNumber,
      getRebalancingPeriod(_vaultNumber),
      _protocolId
    );

    if (currentReward == -1) {
      require(currentAllocation == 0, "Allocations to blacklisted protocol");
    }
  }

  /// @notice function to see the allocation of a specific protocol by a basketId. Only the owner of the basket can view this
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _protocolId Id of the protocol of which the allocation is queried
  /// @return int256 Number of derby tokens that are allocated towards this specific protocol
  function basketAllocationInProtocol(
    uint256 _basketId,
    uint256 _protocolId
  ) public view onlyBasketOwner(_basketId) returns (int256) {
    return baskets[_basketId].allocations[_protocolId];
  }

  /// @notice Setter for rebalancing period of the basket, used to calculate the rewards
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _vaultNumber number of vault
  function setBasketRebalancingPeriod(
    uint256 _basketId,
    uint256 _vaultNumber
  ) internal onlyBasketOwner(_basketId) {
    baskets[_basketId].lastRebalancingPeriod = getRebalancingPeriod(_vaultNumber) + 1;
  }

  /// @notice function to see the total unredeemed rewards the basket has built up. Only the owner of the basket can view this.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @return int256 Total unredeemed rewards. (in vaultCurrency.decimals())
  function basketUnredeemedRewards(
    uint256 _basketId
  ) external view onlyBasketOwner(_basketId) returns (int256) {
    return baskets[_basketId].totalUnRedeemedRewards / int(BASE_SCALE);
  }

  /// @notice function to see the total reeemed rewards from the basket. Only the owner of the basket can view this.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @return int256 Total redeemed rewards.
  function basketRedeemedRewards(
    uint256 _basketId
  ) external view onlyBasketOwner(_basketId) returns (int) {
    return baskets[_basketId].totalRedeemedRewards;
  }

  /// @notice Mints a new NFT with a Basket of allocations.
  /// @dev The basket NFT is minted for a specific vault, starts with a zero allocation and the tokens are not locked here.
  /// @param _chainId Chain ID of the vault.
  /// @param _vaultNumber Number of the vault. Same as in Router.
  /// @return basketId The basket Id the user has minted.
  function mintNewBasket(
    uint32 _chainId,
    uint256 _vaultNumber
  ) external nonReentrant returns (uint256) {
    // mint Basket with nrOfUnAllocatedTokens equal to _lockedTokenAmount
    baskets[latestBasketId].chainId = _chainId;
    baskets[latestBasketId].vaultNumber = _vaultNumber;
    baskets[latestBasketId].lastRebalancingPeriod = getRebalancingPeriod(_vaultNumber) + 1;
    _safeMint(msg.sender, latestBasketId);
    latestBasketId++;

    emit BasketId(msg.sender, latestBasketId - 1);
    return latestBasketId - 1;
  }

  /// @notice Function to lock xaver tokens to a basket. They start out to be unallocated.
  /// @param _lockedTokenAmount Amount of xaver tokens to lock inside this contract.
  function lockTokensToBasket(uint256 _lockedTokenAmount) internal {
    uint256 balanceBefore = derbyToken.balanceOf(address(this));
    derbyToken.safeTransferFrom(msg.sender, address(this), _lockedTokenAmount);
    uint256 balanceAfter = derbyToken.balanceOf(address(this));

    require((balanceAfter - balanceBefore - _lockedTokenAmount) == 0, "Error lock: under/overflow");
  }

  /// @notice Function to unlock xaver tokens. If tokens are still allocated to protocols they first hevae to be unallocated.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @param _unlockedTokenAmount Amount of derby tokens to unlock and send to the user.
  function unlockTokensFromBasket(uint256 _basketId, uint256 _unlockedTokenAmount) internal {
    uint256 tokensBurned = redeemNegativeRewards(_basketId, _unlockedTokenAmount);
    uint256 tokensToUnlock = _unlockedTokenAmount -= tokensBurned;

    uint256 balanceBefore = derbyToken.balanceOf(address(this));
    derbyToken.safeTransfer(msg.sender, tokensToUnlock);
    uint256 balanceAfter = derbyToken.balanceOf(address(this));

    require((balanceBefore - balanceAfter - tokensToUnlock) == 0, "Error unlock: under/overflow");
  }

  /// @notice IMPORTANT: The negativeRewardFactor takes in account an approximation of the price of derby tokens by the dao
  /// @notice IMPORTANT: This will change to an exact price when there is a derby token liquidity pool
  /// @notice Calculates if there are any negative rewards and how many tokens to burn
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _unlockedTokens Amount of derby tokens to unlock and send to user
  /// @return tokensToBurn Amount of derby tokens that are burned
  function redeemNegativeRewards(
    uint256 _basketId,
    uint256 _unlockedTokens
  ) internal returns (uint256) {
    if (baskets[_basketId].totalUnRedeemedRewards / int(BASE_SCALE) > negativeRewardThreshold)
      return 0;

    uint256 vaultNumber = baskets[_basketId].vaultNumber;
    uint256 unreedemedRewards = uint(-baskets[_basketId].totalUnRedeemedRewards);
    uint256 price = tokenPrice[vaultNumber];

    uint256 tokensToBurn = (((unreedemedRewards * negativeRewardFactor) / 100) / price);
    tokensToBurn = tokensToBurn < _unlockedTokens ? tokensToBurn : _unlockedTokens;

    baskets[_basketId].totalUnRedeemedRewards += int(
      (tokensToBurn * 100 * price) / negativeRewardFactor
    );

    IERC20(derbyToken).safeTransfer(homeVault[vaultNumber], tokensToBurn);

    return tokensToBurn;
  }

  /// @notice rebalances an existing Basket
  /// @dev First calculates the rewards the basket has built up, then sets the new allocations and communicates the deltas to the vault
  /// @dev Finally it locks or unlocks tokens
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @param _deltaAllocations delta allocations set by the user of the basket. Allocations are scaled (so * 1E18).
  function rebalanceBasket(
    uint256 _basketId,
    int256[] memory _deltaAllocations
  ) external onlyBasketOwner(_basketId) nonReentrant {
    uint32 chainId = baskets[_basketId].chainId;
    uint256 vaultNumber = baskets[_basketId].vaultNumber;
    if (getRebalancingPeriod(vaultNumber) != 0) {
      require(vaults[chainId][vaultNumber].rewardsReceived, "Game: rewards not settled");
    }

    addToTotalRewards(_basketId);
    int256 totalDelta = settleDeltaAllocations(_basketId, chainId, vaultNumber, _deltaAllocations);

    lockOrUnlockTokens(_basketId, totalDelta);
    setBasketTotalAllocatedTokens(_basketId, totalDelta);
    setBasketRebalancingPeriod(_basketId, vaultNumber);
  }

  /// @notice Internal helper to calculate and settle the delta allocations from baskets
  /// @dev Sets the total allocations per ChainId, used in XChainController
  /// @dev Sets the total allocations per protocol number, used in Vaults
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _chainId Chain id of the vault where the allocations need to be sent
  /// @param _vaultNumber number of vault
  /// @param _deltaAllocations delta allocations set by the user of the basket. Allocations are scaled (so * 1E18)
  /// @return totalDelta total delta allocated tokens of the basket, used in lockOrUnlockTokens
  function settleDeltaAllocations(
    uint256 _basketId,
    uint32 _chainId,
    uint256 _vaultNumber,
    int256[] memory _deltaAllocations
  ) internal returns (int256 totalDelta) {
    uint32 chainId = baskets[_basketId].chainId;
    uint256 latestProtocol = vaults[chainId][_vaultNumber].latestProtocolId;
    require(_deltaAllocations.length == latestProtocol, "Invalid allocation length");

    for (uint256 i = 0; i < latestProtocol; i++) {
      int256 allocation = _deltaAllocations[i];
      if (allocation == 0) continue;
      totalDelta += allocation;
      addDeltaAllocationsProtocol(_chainId, _vaultNumber, i, allocation);
      setBasketAllocationInProtocol(_chainId, _vaultNumber, _basketId, i, allocation);
    }
    addDeltaAllocationsVault(_chainId, _vaultNumber, totalDelta);
  }

  /// @notice rewards are calculated here.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  function addToTotalRewards(uint256 _basketId) internal onlyBasketOwner(_basketId) {
    if (baskets[_basketId].nrOfAllocatedTokens == 0) return;
    uint32 chainId = baskets[_basketId].chainId;
    uint256 vaultNum = baskets[_basketId].vaultNumber;
    uint256 currentRebalancingPeriod = IVault(vaults[chainId][vaultNum].vaultAddress)
      .rebalancingPeriod(); //TODO: rebalancingPeriod should be communicated differently
    uint256 lastRebalancingPeriod = baskets[_basketId].lastRebalancingPeriod;
    console.log("lastRebalancingPeriod", lastRebalancingPeriod);
    console.log("currentRebalancingPeriod", currentRebalancingPeriod);
    console.log("vault addr, current rebalancing period", vaults[chainId][vaultNum].vaultAddress);
    console.log("vault addr, get rebalancing period", homeVault[vaultNum]);
    uint256 rp = getRebalancingPeriod(vaultNum);
    console.log("get rebalancing Period", rp);
    require(currentRebalancingPeriod >= lastRebalancingPeriod, "Already rebalanced");

    uint256 latestProtocol = vaults[chainId][vaultNum].latestProtocolId;
    for (uint i = 0; i < latestProtocol; i++) {
      int256 allocation = basketAllocationInProtocol(_basketId, i) / 1E18;
      if (allocation == 0) continue;

      int256 currentReward = getRewardsPerLockedToken(
        chainId,
        vaultNum,
        currentRebalancingPeriod,
        i
      );
      // -1 means the protocol is blacklisted
      if (currentReward == -1) continue;

      int256 lastRebalanceReward = getRewardsPerLockedToken(
        chainId,
        vaultNum,
        lastRebalancingPeriod,
        i
      );

      baskets[_basketId].totalUnRedeemedRewards +=
        (currentReward - lastRebalanceReward) *
        allocation;
    }
  }

  /// @notice Internal helper to lock or unlock tokens from the game contract
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _totalDelta total delta allocated tokens of the basket, calculated in settleDeltaAllocations
  function lockOrUnlockTokens(uint256 _basketId, int256 _totalDelta) internal {
    if (_totalDelta > 0) {
      lockTokensToBasket(uint256(_totalDelta));
    }
    if (_totalDelta < 0) {
      int256 oldTotal = basketTotalAllocatedTokens(_basketId);
      int256 newTotal = oldTotal + _totalDelta;
      int256 tokensToUnlock = oldTotal - newTotal;
      require(oldTotal >= tokensToUnlock, "Not enough tokens locked");

      unlockTokensFromBasket(_basketId, uint256(tokensToUnlock));
    }
  }

  /// @notice Game pushes deltaAllocations to vaults
  /// @notice Trigger to push delta allocations in protocols to cross chain vaults
  /// @param _chainId Chain id of the vault where the allocations need to be sent
  /// @param _vaultNumber Number of vault
  /// @dev Sends over an array where the index is the protocolId
  function pushAllocationsToVault(
    uint32 _chainId,
    uint256 _vaultNumber
  ) external payable notInSameBlock {
    require(rebalanceNeeded(_vaultNumber), "No rebalance needed");
    address vault = getVaultAddress(_vaultNumber, _chainId);
    require(vault != address(0), "Game: not a valid vaultnumber");

    int256[] memory deltas = protocolAllocationsToArray(_vaultNumber, _chainId);

    IXProvider(xProvider).pushProtocolAllocationsToVault{value: msg.value}(_chainId, vault, deltas);

    lastTimeStamp[_vaultNumber] = block.timestamp;
    vaults[_chainId][_vaultNumber].rewardsReceived = false;

    emit PushProtocolAllocations(_chainId, vault, deltas);
  }

  /// @notice Creates array with delta allocations in protocols for given chainId
  /// @return deltas Array with allocations where the index matches the protocolId
  function protocolAllocationsToArray(
    uint256 _vaultNumber,
    uint32 _chainId
  ) internal returns (int256[] memory deltas) {
    uint256 latestId = vaults[_chainId][_vaultNumber].latestProtocolId;
    deltas = new int[](latestId);

    for (uint256 i = 0; i < latestId; i++) {
      deltas[i] = getDeltaAllocationsProtocol(_chainId, _vaultNumber, i);
      vaults[_chainId][_vaultNumber].deltaAllocationProtocol[i] = 0;
    }
  }

  /// @notice See settleRewardsInt below
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _rewards Rewards per locked token per protocol (each protocol is an element in the array)
  function settleRewards(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) external onlyXProvider {
    settleRewardsInt(_chainId, _vaultNumber, _rewards);
  }

  // basket should not be able to rebalance before this
  /// @notice Vaults push rewardsPerLockedToken to game
  /// @notice Loops through the array and fills the rewardsPerLockedToken mapping with the values
  /// @param _chainId Number of chain used
  /// @param _vaultNumber Number of the vault
  /// @param _rewards Array with rewardsPerLockedToken of all protocols in vault => index matches protocolId
  function settleRewardsInt(
    uint32 _chainId,
    uint256 _vaultNumber,
    int256[] memory _rewards
  ) internal {
    uint256 rebalancingPeriod = getRebalancingPeriod(_vaultNumber);
    for (uint256 i = 0; i < _rewards.length; i++) {
      int256 lastReward = getRewardsPerLockedToken(
        _chainId,
        _vaultNumber,
        rebalancingPeriod - 1,
        i
      );
      vaults[_chainId][_vaultNumber].rewardPerLockedToken[rebalancingPeriod][i] =
        lastReward +
        _rewards[i];
    }

    vaults[_chainId][_vaultNumber].rewardsReceived = true;
  }

  /// @notice Getter for rewardsPerLockedToken for given vaultNumber => chainId => rebalancingPeriod => protocolId
  /// @param _chainId Number of chain used
  /// @param _vaultNumber Number of the vault
  /// @param _rebalancingPeriod Number of the rebalancing period
  /// @param _protocolId Number of the protocol
  function getRewardsPerLockedToken(
    uint32 _chainId,
    uint256 _vaultNumber,
    uint256 _rebalancingPeriod,
    uint256 _protocolId
  ) internal view returns (int256) {
    return vaults[_chainId][_vaultNumber].rewardPerLockedToken[_rebalancingPeriod][_protocolId];
  }

  /// @notice redeem funds from basket in the game.
  /// @dev makes a (crosschain) call to the vault to make the actual transfer because the vault holds the funds.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  function redeemRewards(uint256 _basketId) external onlyBasketOwner(_basketId) {
    int256 value = baskets[_basketId].totalUnRedeemedRewards / int(BASE_SCALE);
    require(value > 0, "Nothing to claim");

    baskets[_basketId].totalRedeemedRewards += value;
    baskets[_basketId].totalUnRedeemedRewards = 0;

    uint32 chainId = baskets[_basketId].chainId;
    uint256 vaultNumber = baskets[_basketId].vaultNumber;
    address vault = getVaultAddress(vaultNumber, chainId);

    IXProvider(xProvider).pushRewardsToVault(chainId, vault, msg.sender, uint256(value));
  }

  /// @notice Checks if a rebalance is needed based on the set interval
  /// @param _vaultNumber The vault number to check for rebalancing
  /// @return bool True if rebalance is needed, false if not
  function rebalanceNeeded(uint256 _vaultNumber) public view returns (bool) {
    return
      (block.timestamp - lastTimeStamp[_vaultNumber]) > rebalanceInterval || msg.sender == guardian;
  }

  /// @notice getter for vault address linked to a chainId
  function getVaultAddress(uint256 _vaultNumber, uint32 _chainId) internal view returns (address) {
    return vaults[_chainId][_vaultNumber].vaultAddress;
  }

  /// @notice Getter for dao address
  function getDao() public view returns (address) {
    return dao;
  }

  /// @notice Getter for guardian address
  function getGuardian() public view returns (address) {
    return guardian;
  }

  /// @notice Getter for rebalancing period for a vault
  function getRebalancingPeriod(uint256 _vaultNumber) public view returns (uint256) {
    return IVault(homeVault[_vaultNumber]).rebalancingPeriod();
  }

  /*
  Only Dao functions
  */

  /// @notice Setter for xProvider address
  /// @param _xProvider new address of xProvider on this chain
  function setXProvider(address _xProvider) external onlyDao {
    xProvider = _xProvider;
  }

  /// @notice Setter for homeVault address
  /// @param _vaultNumber The vault number to set the home vault for
  /// @param _homeVault new address of homeVault on this chain
  function setHomeVault(uint256 _vaultNumber, address _homeVault) external onlyDao {
    homeVault[_vaultNumber] = _homeVault;
  }

  /// @notice Set minimum interval for the rebalance function
  /// @param _timestampInternal UNIX timestamp
  function setRebalanceInterval(uint256 _timestampInternal) external onlyDao {
    rebalanceInterval = _timestampInternal;
  }

  /// @notice Setter for DAO address
  /// @param _dao DAO address
  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }

  /// @notice Setter for guardian address
  /// @param _guardian new address of the guardian
  function setGuardian(address _guardian) external onlyDao {
    guardian = _guardian;
  }

  /// @notice Setter Derby token address
  /// @param _derbyToken new address of Derby token
  function setDerbyToken(address _derbyToken) external onlyDao {
    derbyToken = IERC20(_derbyToken);
  }

  /// @notice Setter for threshold at which user tokens will be sold / burned
  /// @param _threshold treshold in vaultCurrency e.g USDC, must be negative
  function setNegativeRewardThreshold(int256 _threshold) external onlyDao {
    negativeRewardThreshold = _threshold;
  }

  /// @notice Setter for negativeRewardFactor
  /// @param _factor percentage of tokens that will be sold / burned
  function setNegativeRewardFactor(uint256 _factor) external onlyDao {
    negativeRewardFactor = _factor;
  }

  /*
  Only Guardian functions
  */

  /// @notice Setter for tokenPrice
  /// @param _vaultNumber Number of the vault
  /// @param _tokenPrice tokenPrice in vaultCurrency / derbyTokenPrice
  function setTokenPrice(uint256 _vaultNumber, uint256 _tokenPrice) external onlyGuardian {
    tokenPrice[_vaultNumber] = _tokenPrice;
  }

  /// @notice setter to link a chainId to a vault address for cross chain functions
  function setVaultAddress(
    uint256 _vaultNumber,
    uint32 _chainId,
    address _address
  ) external onlyGuardian {
    vaults[_chainId][_vaultNumber].vaultAddress = _address;
  }

  /// @notice Setter for latest protocol Id for given chainId.
  /// @param _chainId number of chain id set in chainIds array
  /// @param _vaultNumber number of vault
  /// @param _latestProtocolId latest protocol Id aka number of supported protocol vaults, starts at 0
  function setLatestProtocolId(
    uint32 _chainId,
    uint256 _vaultNumber,
    uint256 _latestProtocolId
  ) external onlyGuardian {
    vaults[_chainId][_vaultNumber].latestProtocolId = _latestProtocolId;
  }

  /// @notice Guardian function
  function settleRewardsGuard(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) external onlyGuardian {
    settleRewardsInt(_chainId, _vaultNumber, _rewards);
  }

  /// @notice setter for rewardsReceived
  /// @param _chainId Number of chain used
  /// @param _vaultNumber Number of the vault
  /// @param _rewardsReceived bool to set if rewards are received
  function setRewardsReceived(
    uint32 _chainId,
    uint256 _vaultNumber,
    bool _rewardsReceived
  ) external onlyGuardian {
    vaults[_chainId][_vaultNumber].rewardsReceived = _rewardsReceived;
  }
}
