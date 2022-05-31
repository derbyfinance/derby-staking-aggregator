// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./XaverToken.sol";

import "./Interfaces/IETFVault.sol";
import "./Interfaces/IController.sol";
import "./Interfaces/IETFGame.sol";
import "./Interfaces/IGoverned.sol";

import "./libraries/ABDKMath64x64.sol";

import "hardhat/console.sol";

contract ETFGame is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // xaver token address
    address public xaverTokenAddress;

    // router address
    address public routerAddress;

    // address of DAO governance contract
    address public governed;

    // controller
    IController public controller;

    // vault addresses
    mapping(address => bool) vaultAddresses;

    modifier onlyDao {
        require(msg.sender == governed, "ETFGame: only DAO");
        _;
    }

    modifier onlyBasketOwner(uint256 _basketId) {
        require(msg.sender == ownerOf(_basketId), "ETFGame Not the owner of the basket");
        _;
    }

    constructor(
        string memory name_, 
        string memory symbol_, 
        address _xaverTokenAddress, 
        address _routerAddress,
        address _governed,
        address _controller
    ) 
        ERC721(name_, symbol_) {
        xaverTokenAddress = _xaverTokenAddress;
        routerAddress = _routerAddress;
        governed = _governed;
        controller = IController(_controller);
    }

    // latest basket id
    uint256 private latestBasketId;

    // latest ETFnumber
    uint256 public latestETFNumber = 0;

    // maps the ETF number to the vault address of the ETF
    mapping(uint256 => address) public ETFVaults;

    // stores the total value locked per active locked derby token in the game. Stored per ETFvault per period.
    // first index is ETFvault, second is rebalancing period.
    mapping(uint256 => mapping(uint256 => uint256)) public cumTVLperToken;

    // baskets, maps tokenID from BasketToken NFT contract to the Basket struct in this contract.
    mapping(uint256 => Basket) private baskets;

    struct Basket {
        // the ETF number for which this Basket was created
        uint256 ETFnumber;

        // last period when this Basket got rebalanced
        uint256 lastRebalancingPeriod;

        // nr of total allocated tokens 
        uint256 nrOfAllocatedTokens;

        // total build up rewards
        int256 totalUnRedeemedRewards;

        // total redeemed rewards
        int256 totalRedeemedRewards;

        // allocations per period
        mapping(uint256 => uint256) allocations;
    }

    /// @notice function to see the total number of allocated tokens. Only the owner of the basket can view this. 
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @return uint256 Number of xaver tokens that are allocated towards protocols. 
    function basketTotalAllocatedTokens(uint256 _basketId) external onlyBasketOwner(_basketId) view returns(uint256){
        return baskets[_basketId].nrOfAllocatedTokens;
    }

    /// @notice function to see the allocation of a specific protocol by a basketId. Only the owner of the basket can view this. 
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @param _protocolId Id of the protocol of which the allocation is queried.
    /// @return uint256 Number of xaver tokens that are allocated towards this specific protocol. 
    function basketAllocationInProtocol(uint256 _basketId, uint256 _protocolId) external onlyBasketOwner(_basketId) view returns(uint256){
        return baskets[_basketId].allocations[_protocolId];
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
    /// @param _ETFVaultAddress Address of the vault which is added.
    function addETF(address _ETFVaultAddress) external onlyDao {
        require (!vaultAddresses[_ETFVaultAddress], "ETFGame, ETF adres already added");
        ETFVaults[latestETFNumber] = _ETFVaultAddress;
        vaultAddresses[_ETFVaultAddress] = true;
        latestETFNumber++;
    }

    /// @notice Mints a new NFT with a Basket of allocations.
    /// @dev The basket NFT is minted for a specific vault, starts with a zero allocation and the tokens are not locked here.
    /// @param _ETFnumber Number of the vault. Same as in Router.
    function mintNewBasket(uint256 _ETFnumber) external {
        require(_ETFnumber < latestETFNumber, "ETFGame: invalid ETF number");
        // mint Basket with nrOfUnAllocatedTokens equal to _lockedTokenAmount
        baskets[latestBasketId].ETFnumber = _ETFnumber;
        baskets[latestBasketId].lastRebalancingPeriod = IETFVault(ETFVaults[_ETFnumber]).rebalancingPeriod() + 1;
        _safeMint(msg.sender, latestBasketId);
        latestBasketId++;
    }

    /// @notice Function to lock xaver tokens to a basket. They start out to be unallocated. 
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @param _lockedTokenAmount Amount of xaver tokens to lock inside this contract. 
    function lockTokensToBasket(uint256 _basketId, uint256 _lockedTokenAmount) internal onlyBasketOwner(_basketId) {
        uint256 balanceBefore = IERC20(xaverTokenAddress).balanceOf(address(this));
        IERC20(xaverTokenAddress).safeTransferFrom(msg.sender, address(this), _lockedTokenAmount);
        uint256 balanceAfter = IERC20(xaverTokenAddress).balanceOf(address(this));
        require((balanceAfter - balanceBefore - _lockedTokenAmount) == 0, "Error lock: under/overflow");

        baskets[_basketId].nrOfAllocatedTokens += _lockedTokenAmount;
    }
    

    /// @notice Function to unlock xaver tokens. If tokens are still allocated to protocols they first hevae to be unallocated.  
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @param _lockedTokenAmount Amount of xaver tokens to lock inside this contract.
    function unlockTokensFromBasket(uint256 _basketId, uint256 _lockedTokenAmount) internal onlyBasketOwner(_basketId) {
        require(baskets[_basketId].nrOfAllocatedTokens >= _lockedTokenAmount, "Not enough unallocated tokens in basket");

        baskets[_basketId].nrOfAllocatedTokens -= _lockedTokenAmount;

        uint256 balanceBefore = IERC20(xaverTokenAddress).balanceOf(address(this));
        IERC20(xaverTokenAddress).safeTransfer(msg.sender, _lockedTokenAmount);
        uint256 balanceAfter = IERC20(xaverTokenAddress).balanceOf(address(this));

        require((balanceBefore - balanceAfter - _lockedTokenAmount) == 0, "Error unlock: under/overflow");
    }

    /// @notice rebalances an existing Basket
    /// @dev First calculates the rewards the basket has built up, then sets the new allocations and communicates the deltas to the vault
    /// @dev Finally it locks or unlocks tokens
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @param _allocations allocations set by the user of the basket. Allocations are real (not deltas) and scaled (so * 1E18).
    function rebalanceBasket(uint256 _basketId, uint256[] memory _allocations) external onlyBasketOwner(_basketId) nonReentrant {
        require(_allocations.length == IController(routerAddress).latestProtocolId(baskets[_basketId].ETFnumber), "Allocations array does not have the correct length");

        addToTotalRewards(_basketId);

        uint256 totalNewAllocatedTokens = 0;
        int256 deltaAllocation;
        for (uint256 i = 0; i < _allocations.length; i++) {
            totalNewAllocatedTokens += _allocations[i];
            if (baskets[_basketId].allocations[i] == _allocations[i]) continue;
            deltaAllocation = int256(_allocations[i] - baskets[_basketId].allocations[i]);
            IETFVault(ETFVaults[baskets[_basketId].ETFnumber]).setDeltaAllocations(i, deltaAllocation);
            baskets[_basketId].allocations[i] = _allocations[i];
        }

        if (baskets[_basketId].nrOfAllocatedTokens > totalNewAllocatedTokens) {
            unlockTokensFromBasket(_basketId, baskets[_basketId].nrOfAllocatedTokens - totalNewAllocatedTokens);
        }
        else if (baskets[_basketId].nrOfAllocatedTokens < totalNewAllocatedTokens) {
            lockTokensToBasket(_basketId, totalNewAllocatedTokens - baskets[_basketId].nrOfAllocatedTokens);
        }

        baskets[_basketId].lastRebalancingPeriod = IETFVault(ETFVaults[baskets[_basketId].ETFnumber]).rebalancingPeriod() + 1;
    }

    /// @notice rewards are calculated here.
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    function addToTotalRewards(uint256 _basketId) internal onlyBasketOwner(_basketId) {
        if (baskets[_basketId].nrOfAllocatedTokens == 0) return;
        address ETFaddress = ETFVaults[baskets[_basketId].ETFnumber];
        uint256 currentRebalancingPeriod = IETFVault(ETFaddress).rebalancingPeriod();
        uint256 lastRebalancingPeriod = baskets[_basketId].lastRebalancingPeriod;

        if(currentRebalancingPeriod <= lastRebalancingPeriod) return;

        for (uint j = lastRebalancingPeriod; j <= currentRebalancingPeriod; j++) {
            for (uint i = 0; i < controller.latestProtocolId(baskets[_basketId].ETFnumber); i++) {
                if (baskets[_basketId].allocations[i] == 0) continue;
                baskets[_basketId].totalUnRedeemedRewards += IETFVault(ETFaddress).rewardPerLockedToken(j, i) * int256(baskets[_basketId].allocations[i]);
            }
        }
    }

    /// @notice redeem funds from basket in the game.
    /// @dev makes a call to the vault to make the actual transfer because the vault holds the funds.
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    function redeemRewards(uint256 _basketId) external onlyBasketOwner(_basketId) {   
        int256 amount = baskets[_basketId].totalUnRedeemedRewards;
        baskets[_basketId].totalRedeemedRewards += amount;
        baskets[_basketId].totalUnRedeemedRewards = 0;

        IETFVault(ETFVaults[baskets[_basketId].ETFnumber]).redeemRewards(msg.sender, uint256(amount));
    }
}
