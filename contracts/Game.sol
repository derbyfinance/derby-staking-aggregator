// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./DerbyToken.sol";

import "./Interfaces/IVault.sol";
import "./Interfaces/IController.sol";
import "./Interfaces/IGame.sol";
import "./Interfaces/IGoverned.sol";
import "./Interfaces/IXProvider.sol";

import "hardhat/console.sol";

contract Game is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Basket {
      // the ETF number for which this Basket was created
      uint256 vaultNumber;
      // last period when this Basket got rebalanced
      uint256 lastRebalancingPeriod;
      // nr of total allocated tokens 
      int256 nrOfAllocatedTokens;
      // total build up rewards
      int256 totalUnRedeemedRewards;
      // total redeemed rewards
      int256 totalRedeemedRewards;
      // basket => vaultNumber => chainId => allocation
      mapping(uint256 => mapping(uint256 => int256)) allocations;
    }

    struct vaultInfo {
      // rebalance period of ETF, upped at vault rebalance
      uint256 rebalancingPeriod;
      // address of vault
      address vaultAddressOLD; // OLD will be changed //////////
      // chainId => vaultAddress
      mapping(uint16 => address) vaultAddress;
      // chainId => deltaAllocation
      mapping(uint256 => int256) deltaAllocationChain;
      // chainId => protocolNumber => deltaAllocation
      mapping(uint256 => mapping(uint256 => int256)) deltaAllocationProtocol;
      // chainId => rebalancing period => protocol id => rewardPerLockedToken.
      mapping(uint16 => mapping(uint256 => mapping(uint256 => int256))) rewardPerLockedToken;
    }

    address public derbyTokenAddress;
    address public routerAddress;
    address public governed;
    address public xProvider;

    IController public controller;

    // latest basket id
    uint256 private latestBasketId;

    // latest vaultNumber
    uint256 public latestvaultNumber = 0;

    // array of chainIds e.g [10, 100, 1000];
    uint16[] public chainIds;

    // vault addresses
    mapping(address => bool) vaultAddresses;

    // stores the total value locked per active locked derby token in the game. Stored per vault per period.
    // first index is vault, second is rebalancing period.
    mapping(uint256 => mapping(uint256 => uint256)) public cumTVLperToken;

    // baskets, maps tokenID from BasketToken NFT contract to the Basket struct in this contract.
    mapping(uint256 => Basket) private baskets;
    
    // chainId => latestProtocolId set by dao
    mapping(uint256 => uint256) public latestProtocolId;

    // vaultNumber => vaultInfo struct
    mapping(uint256 => vaultInfo) internal vaults;

    mapping(uint256 => bool) public isXChainRebalancing;


    modifier onlyDao {
      require(msg.sender == governed, "Game: only DAO");
      _;
    }

    modifier onlyBasketOwner(uint256 _basketId) {
      require(msg.sender == ownerOf(_basketId), "Game: Not the owner of the basket");
      _;
    }


    constructor(
      string memory name_, 
      string memory symbol_, 
      address _derbyTokenAddress, 
      address _routerAddress,
      address _governed,
      address _controller
    ) 
      ERC721(name_, symbol_) {
      derbyTokenAddress = _derbyTokenAddress;
      routerAddress = _routerAddress;
      governed = _governed;
      controller = IController(_controller);
    }

    /// @notice Setter for delta allocation in a particulair chainId
    /// @param _vaultNumber number of vault
    /// @param _chainId number of chainId
    /// @param _deltaAllocation delta allocation
    function setDeltaAllocationChain(
      uint256 _vaultNumber, 
      uint256 _chainId, 
      int256 _deltaAllocation
    ) internal {
      vaults[_vaultNumber].deltaAllocationChain[_chainId] += _deltaAllocation;
    }

    /// @notice Getter for delta allocation in a particulair chainId
    /// @param _vaultNumber number of vault
    /// @param _chainId number of chainId
    /// @return allocation delta allocation
    function getDeltaAllocationChain(
      uint256 _vaultNumber, 
      uint256 _chainId 
    ) internal view returns(int256) {
      return vaults[_vaultNumber].deltaAllocationChain[_chainId];
    }

    /// @notice Setter for the delta allocation in Protocol vault e.g compound_usdc_01
    /// @dev Allocation can be negative
    /// @param _vaultNumber number of vault
    /// @param _chainId number of chainId
    /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
    /// @param _deltaAllocation Delta allocation in tokens
    function setDeltaAllocationProtocol(
      uint256 _vaultNumber,
      uint256 _chainId, 
      uint256 _protocolNum, 
      int256 _deltaAllocation
    ) internal {
      vaults[_vaultNumber].deltaAllocationProtocol[_chainId][_protocolNum] += _deltaAllocation;
    }

    /// @notice Getter for the delta allocation in Protocol vault e.g compound_usdc_01
    /// @param _vaultNumber number of vault
    /// @param _chainId number of chainId
    /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
    /// @return allocation Delta allocation in tokens
    function getDeltaAllocationProtocol(
      uint256 _vaultNumber, 
      uint256 _chainId,
      uint256 _protocolNum
    ) internal view returns(int256) {
      return vaults[_vaultNumber].deltaAllocationProtocol[_chainId][_protocolNum];
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
    function basketTotalAllocatedTokens(
      uint256 _basketId
    ) public onlyBasketOwner(_basketId) view returns(int256) {
      return baskets[_basketId].nrOfAllocatedTokens;
    }

    /// @notice Setter to set the allocation of a specific protocol by a basketId. Only the owner of the basket can set this. 
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @param _chainId number of chainId.
    /// @param _protocolId Id of the protocol of which the allocation is queried.
    /// @param _allocation Number of derby tokens that are allocated towards this specific protocol. 
    function setBasketAllocationInProtocol(
      uint256 _basketId,
      uint256 _chainId,
      uint256 _protocolId,
      int256 _allocation
    ) internal onlyBasketOwner(_basketId) {
      baskets[_basketId].allocations[_chainId][_protocolId] += _allocation;
      require(basketAllocationInProtocol(_basketId, _chainId, _protocolId) >= 0, "Basket: underflow");
    }

    /// @notice function to see the allocation of a specific protocol by a basketId. Only the owner of the basket can view this 
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
    /// @param _chainId number of chainId
    /// @param _protocolId Id of the protocol of which the allocation is queried
    /// @return int256 Number of derby tokens that are allocated towards this specific protocol
    function basketAllocationInProtocol(
      uint256 _basketId,
      uint256 _chainId,
      uint256 _protocolId
    ) public onlyBasketOwner(_basketId) view returns(int256) {
      return baskets[_basketId].allocations[_chainId][_protocolId];
    }

    /// @notice Setter for rebalancing period of the basket, used to calculate the rewards
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
    /// @param _vaultNumber number of vault
    function setBasketRebalancingPeriod(
      uint256 _basketId,
      uint256 _vaultNumber
    ) internal onlyBasketOwner(_basketId) {
      baskets[_basketId].lastRebalancingPeriod = vaults[_vaultNumber].rebalancingPeriod + 1;
    }

    /// @notice function to see the total unredeemed rewards the basket has built up. Only the owner of the basket can view this. 
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @return int256 Total unredeemed rewards. 
    function basketUnredeemedRewards(uint256 _basketId) external onlyBasketOwner(_basketId) view returns(int256){
      return baskets[_basketId].totalUnRedeemedRewards;
    }

    /// @notice function to see the total reeemed rewards from the basket. Only the owner of the basket can view this. 
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @return int256 Total redeemed rewards. 
    function basketRedeemedRewards(uint256 _basketId) external onlyBasketOwner(_basketId) view returns(int256){
      return baskets[_basketId].totalRedeemedRewards;
    }

    /// @notice Adding a vault to the game.
    /// @param _vaultAddress Address of the vault which is added.
    function addETF(address _vaultAddress) external onlyDao {
      require (!vaultAddresses[_vaultAddress], "Game: vault already added");
      vaults[latestvaultNumber].vaultAddressOLD = _vaultAddress;
      vaultAddresses[_vaultAddress] = true;
      latestvaultNumber++;
    }

    /// @notice Mints a new NFT with a Basket of allocations.
    /// @dev The basket NFT is minted for a specific vault, starts with a zero allocation and the tokens are not locked here.
    /// @param _vaultNumber Number of the vault. Same as in Router.
    function mintNewBasket(uint256 _vaultNumber) external {
      require(_vaultNumber < latestvaultNumber, "Game: invalid ETF number");
      // mint Basket with nrOfUnAllocatedTokens equal to _lockedTokenAmount
      baskets[latestBasketId].vaultNumber = _vaultNumber;
      baskets[latestBasketId].lastRebalancingPeriod = vaults[_vaultNumber].rebalancingPeriod + 1;
      _safeMint(msg.sender, latestBasketId);
      latestBasketId++;
    }

    /// @notice Function to lock xaver tokens to a basket. They start out to be unallocated. 
    /// @param _lockedTokenAmount Amount of xaver tokens to lock inside this contract. 
    function lockTokensToBasket(uint256 _lockedTokenAmount) internal {
      uint256 balanceBefore = IERC20(derbyTokenAddress).balanceOf(address(this));
      IERC20(derbyTokenAddress).safeTransferFrom(msg.sender, address(this), _lockedTokenAmount);
      uint256 balanceAfter = IERC20(derbyTokenAddress).balanceOf(address(this));

      require((balanceAfter - balanceBefore - _lockedTokenAmount) == 0, "Error lock: under/overflow");
    }
    

    /// @notice Function to unlock xaver tokens. If tokens are still allocated to protocols they first hevae to be unallocated.  
    /// @param _unlockedTokenAmount Amount of xaver tokens to unlock inside this contract.
    function unlockTokensFromBasket(uint256 _unlockedTokenAmount) internal {
      uint256 balanceBefore = IERC20(derbyTokenAddress).balanceOf(address(this));
      IERC20(derbyTokenAddress).safeTransfer(msg.sender, _unlockedTokenAmount);
      uint256 balanceAfter = IERC20(derbyTokenAddress).balanceOf(address(this));

      require((balanceBefore - balanceAfter - _unlockedTokenAmount) == 0, "Error unlock: under/overflow");
    }

    /// @notice rebalances an existing Basket
    /// @dev First calculates the rewards the basket has built up, then sets the new allocations and communicates the deltas to the vault
    /// @dev Finally it locks or unlocks tokens
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @param _deltaAllocations delta allocations set by the user of the basket. Allocations are scaled (so * 1E18).
    function rebalanceBasket(
      uint256 _basketId, 
      int256[][] memory _deltaAllocations
    ) external onlyBasketOwner(_basketId) nonReentrant {    
      uint256 vaultNumber = baskets[_basketId].vaultNumber;
      require(!isXChainRebalancing[vaultNumber], "Game: vault is xChainRebalancing");

      addToTotalRewards(_basketId);

      int256 totalDelta = settleDeltaAllocations(_basketId, vaultNumber, _deltaAllocations);
      lockOrUnlockTokens(_basketId, totalDelta);
      setBasketTotalAllocatedTokens(_basketId, totalDelta);
      setBasketRebalancingPeriod(_basketId, vaultNumber);
    }

    /// @notice Internal helper to calculate and settle the delta allocations from baskets
    /// @dev Sets the total allocations per ChainId, used in XChainController
    /// @dev Sets the total allocations per protocol number, used in Vaults
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
    /// @param _vaultNumber number of vault
    /// @param _deltaAllocations delta allocations set by the user of the basket. Allocations are scaled (so * 1E18)
    /// @return totalDelta total delta allocated tokens of the basket, used in lockOrUnlockTokens
    function settleDeltaAllocations(
      uint256 _basketId, 
      uint256 _vaultNumber,
      int256[][] memory _deltaAllocations
    ) internal returns(int256 totalDelta) {
      for (uint256 i = 0; i < _deltaAllocations.length; i++) {
        int256 chainTotal;
        uint16 chain = chainIds[i];
        uint256 latestProtocol = latestProtocolId[chain];

        require(_deltaAllocations[i].length == latestProtocol, "Invalid allocation length");

        for (uint256 j = 0; j < latestProtocol; j++) {
          int256 allocation = _deltaAllocations[i][j];
          if (allocation == 0) continue;

          chainTotal += allocation;
          setDeltaAllocationProtocol(_vaultNumber, chain, j, allocation);
          setBasketAllocationInProtocol(_basketId, chain, j, allocation);
        }

        totalDelta += chainTotal;
        setDeltaAllocationChain(_vaultNumber, chain, chainTotal);
      }
    }

    /// @notice rewards are calculated here.
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    function addToTotalRewards(uint256 _basketId) internal onlyBasketOwner(_basketId) {
      if (baskets[_basketId].nrOfAllocatedTokens == 0) return;

      uint256 vaultNum = baskets[_basketId].vaultNumber;
      uint256 currentRebalancingPeriod = vaults[vaultNum].rebalancingPeriod;
      uint256 lastRebalancingPeriod = baskets[_basketId].lastRebalancingPeriod;

      if(currentRebalancingPeriod <= lastRebalancingPeriod) return;

      for (uint k = 0; k < chainIds.length; k++) {
        uint16 chain = chainIds[k];
        console.log("chain %s", chain);

        for (uint i = 0; i < latestProtocolId[chain]; i++) {
          int256 allocation = basketAllocationInProtocol(_basketId, chain, i) / 1E18;
          if (allocation == 0) continue;

          int256 lastRebalanceReward = getRewardsPerLockedToken(vaultNum, chain, lastRebalancingPeriod, i);
          int256 currentReward = getRewardsPerLockedToken(vaultNum, chain, currentRebalancingPeriod, i);
          baskets[_basketId].totalUnRedeemedRewards += (currentReward - lastRebalanceReward) * allocation;
          
          console.log("reward %s", uint((currentReward - lastRebalanceReward) * allocation));
        }
      }
    }

    /// @notice Internal helper to lock or unlock tokens from the game contract
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
    /// @param _totalDelta total delta allocated tokens of the basket, calculated in settleDeltaAllocations
    function lockOrUnlockTokens(
      uint256 _basketId,
      int256 _totalDelta
    ) internal {
      if (_totalDelta > 0) {
        lockTokensToBasket(uint256(_totalDelta));
      }
      if (_totalDelta < 0) {
        int256 oldTotal = basketTotalAllocatedTokens(_basketId);
        int256 newTotal = oldTotal + _totalDelta;
        int256 tokensToUnlock = oldTotal - newTotal;
        require(oldTotal >= tokensToUnlock, "Not enough tokens locked");

        unlockTokensFromBasket(uint256(tokensToUnlock));
      }
    }

    /// @notice Trigger for Dao to push delta allocations to the xChainController
    /// @dev Sends over an array that should match the IDs in chainIds array
    function pushAllocationsToController(uint256 _vaultNumber) external {
      require(!isXChainRebalancing[_vaultNumber], "Vault is already rebalancing");
      isXChainRebalancing[_vaultNumber] = true;

      int256[] memory deltas = allocationsToArray(_vaultNumber);
      IXProvider(xProvider).pushAllocations(_vaultNumber, deltas);
    }

    /// @notice Creates delta allocation array for chains matching IDs in chainIds array
    /// @notice Resets deltaAllocation for chainIds
    /// @return deltas Array with delta Allocations for all chainIds
    function allocationsToArray(uint256 _vaultNumber) internal returns(int256[] memory deltas) {
      deltas = new int[](chainIds.length);

      for (uint256 i = 0; i < chainIds.length; i++) {
        uint16 chain = chainIds[i];
        deltas[i] = getDeltaAllocationChain(_vaultNumber, chain);
        vaults[_vaultNumber].deltaAllocationChain[chain] = 0;
      }
    }

    /// @notice Trigger to push delta allocations in protocols to cross chain vaults
    /// @dev Sends over an array where the index is the protocolId
    function pushAllocationsToVaults(uint256 _vaultNumber) external {
      require(isXChainRebalancing[_vaultNumber], "Vault is not rebalancing");

      for (uint256 i = 0; i < chainIds.length; i++) {
        uint16 chain = chainIds[i];
        int256[] memory deltas = protocolAllocationsToArray(_vaultNumber, chain);
        
        IXProvider(xProvider).pushProtocolAllocationsToVault(
          chain,
          getVaultAddress(_vaultNumber, chain),
          deltas
        );
      }

      vaults[_vaultNumber].rebalancingPeriod ++;
      isXChainRebalancing[_vaultNumber] = false;
    }

    /// @notice Creates array with delta allocations in protocols for given chainId
    /// @return deltas Array with allocations where the index matches the protocolId
    function protocolAllocationsToArray(
      uint256 _vaultNumber, 
      uint16 _chainId
    ) internal returns(int256[] memory deltas) {
      uint256 latestId = latestProtocolId[_chainId];
      deltas = new int[](latestId);

      for (uint256 i = 0; i < latestId; i++) {
        deltas[i] = getDeltaAllocationProtocol(_vaultNumber, _chainId, i);
        // allocation to zero
        setDeltaAllocationProtocol(_vaultNumber, _chainId, i, 0);
      }
    }

    // Only provider modifier, basket should not be able to rebalance before this step
    /// @notice Loops through the array and fills the rewardsPerLockedToken mapping with the values
    /// @param _vaultNumber Number of the vault
    /// @param _chainId Number of chain used
    /// @param _rewards Array with rewardsPerLockedToken of all protocols in vault => index matches protocolId
    function settlePriceAndRewards(
      uint256 _vaultNumber,
      uint16 _chainId,
      int256[] memory _rewards
    ) public {
      uint256 rebalancingPeriod = vaults[_vaultNumber].rebalancingPeriod;

      for (uint256 i = 0; i < _rewards.length; i++) {
        int256 lastReward = getRewardsPerLockedToken(_vaultNumber, _chainId, rebalancingPeriod - 1, i);
        vaults[_vaultNumber].rewardPerLockedToken[_chainId][rebalancingPeriod][i] = lastReward + _rewards[i];
        console.log("Game: cumulative rewards %s", uint(vaults[_vaultNumber].rewardPerLockedToken[_chainId][rebalancingPeriod][i]));
      }
    }

    /// @notice Getter for rewardsPerLockedToken for given vaultNumber => chainId => rebalancingPeriod => protocolId
    function getRewardsPerLockedToken(
      uint256 _vaultNumber, 
      uint16 _chainId, 
      uint256 _rebalancingPeriod, 
      uint256 _protocolId
    ) internal view returns(int256) {
      return vaults[_vaultNumber].rewardPerLockedToken[_chainId][_rebalancingPeriod][_protocolId];
    }

    /// @notice redeem funds from basket in the game.
    /// @dev makes a call to the vault to make the actual transfer because the vault holds the funds.
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    function redeemRewards(uint256 _basketId) external onlyBasketOwner(_basketId) {   
      // int256 amount = baskets[_basketId].totalUnRedeemedRewards;
      // baskets[_basketId].totalRedeemedRewards += amount;
      // baskets[_basketId].totalUnRedeemedRewards = 0;

      // IVault(vaults[baskets[_basketId].vaultNumber]).redeemRewards(msg.sender, uint256(amount));
    }

    /// @notice setter to link a chainId to a vault address for cross chain functions
    function setVaultAddress(uint256 _vaultNumber, uint16 _chainId, address _address) external onlyDao {
      vaults[_vaultNumber].vaultAddress[_chainId] = _address;
    }

    /// @notice getter for vault address linked to a chainId
    function getVaultAddress(uint256 _vaultNumber, uint16 _chainId) internal view returns(address) {
      return vaults[_vaultNumber].vaultAddress[_chainId];
    }

    /// @notice Setter for latest protocol Id for given chainId.
    /// @param _chainId number of chain id set in chainIds array
    /// @param _latestProtocolId latest protocol Id aka number of supported protocol vaults, starts at 0
    function setLatestProtocolId(uint16 _chainId, uint256 _latestProtocolId) external onlyDao {
      latestProtocolId[_chainId] = _latestProtocolId;
    }

    /// @notice Setter for chainId array
    /// @param _chainIds array of all the used chainIds
    function setChainIdArray(uint16[] memory _chainIds) external onlyDao {
      chainIds = _chainIds;
    }

    /// @notice Setter for xProvider address
    /// @param _xProvider new address of xProvider on this chain
    function setXProvider(address _xProvider) external onlyDao {
      xProvider = _xProvider;
    }
}