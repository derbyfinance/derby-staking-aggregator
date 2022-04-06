// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "./XaverToken.sol";

import "./Interfaces/IETFVault.sol";
import "./Interfaces/IETFGame.sol";
import "./Interfaces/IGoverned.sol";

contract ETFGame is ERC721 {
    using SafeERC20 for IERC20;

    // xaver token address
    address public xaverTokenAddress;

    // address of DAO governance contract
    address public governed;

    modifier onlyDao {
        require(msg.sender == governed, "ETFGame: only DAO");
        _;
    }

    modifier onlyBasketOwner(uint256 _basketId) {
        require(msg.sender == IBasketToken(basketTokenAddress).ownerOf(_basketId), "ETFGame Not the owner of the basket");
        _;
    }

    constructor(
        string memory name_, 
        string memory symbol_, 
        address _xaverTokenAddress, 
        address _governed
    ) 
        ERC721(name_, symbol_) {
        xaverTokenAddress = _xaverTokenAddress;
        governed = _governed;
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
        uint256 latestAdjustmentPeriod;

        // last basket price
        uint256 lastBasketPrice;

        // nr of total allocated tokens 
        uint256 nrOfAllocatedTokens;

        // total build up rewards
        uint256 totalUnRedeemedRewards;

        // total redeemed rewards
        uint256 totalRedeemedRewards;

        // allocations per period
        mapping(uint256 => uint256) allocations;
    }

    /// @notice function to see the total number of allocated tokens. Only the owner of the basket can view this. 
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @return uint256 Number of xaver tokens that are allocated towards protocols. 
    function basketTotalAllocatedTokens(uint256 _basketId) public onlyBasketOwner(_basketId) view returns(uint256){
        return baskets[_basketId].nrOfAllocatedTokens;
    }

    /// @notice function to see the allocation of a specific protocol by a basketId. Only the owner of the basket can view this. 
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @param _protocolId Id of the protocol of which the allocation is queried.
    /// @return uint256 Number of xaver tokens that are allocated towards this specific protocol. 
    function basketAllocationInProtocol(uint256 _basketId, uint256 _protocolId) public onlyBasketOwner(_basketId) view returns(uint256){
        return baskets[_basketId].allocations[_protocolId];
    }

    /// @notice Adding a vault to the game.
    /// @param _ETFVaultAddress Address of the vault which is added.
    function addETF(address _ETFVaultAddress) public onlyDao {
        ETFVaults[latestETFNumber] = _ETFVaultAddress;
        latestETFNumber++;
    }

    /// @notice Mints a new NFT with a Basket of allocations.
    /// @dev The basket NFT is minted for a specific vault, starts with a zero allocation and the tokens are not locked here.
    /// @param _ETFnumber Number of the vault. Same as in Router.
    function mintNewBasket(uint256 _ETFnumber) public {
        // mint Basket with nrOfUnAllocatedTokens equal to _lockedTokenAmount
        _safeMint(msg.sender, latestBasketId);
        baskets[latestBasketId].ETFnumber = _ETFnumber;
        baskets[latestBasketId].latestAdjustmentPeriod = IETFVault(ETFVaults[_ETFnumber]).rebalancingPeriod() + 1;
        latestBasketId++;
    }

    /// @notice Function to lock xaver tokens to a basket. They start out to be unallocated. 
    /// @param _user User address from which the xaver tokens are locked inside this contract.
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @param _lockedTokenAmount Amount of xaver tokens to lock inside this contract.
    function lockTokensToBasket(address _user, uint256 _basketId, uint256 _lockedTokenAmount) internal onlyBasketOwner(_basketId) {
        uint256 balanceBefore = IERC20(xaverTokenAddress).balanceOf(address(this));
        IERC20(xaverTokenAddress).safeTransferFrom(_user, address(this), _lockedTokenAmount);
        uint256 balanceAfter = IERC20(xaverTokenAddress).balanceOf(address(this));
        require((balanceAfter - balanceBefore - _lockedTokenAmount) == 0, "Error lock: under/overflow");

        baskets[_basketId].nrOfAllocatedTokens += _lockedTokenAmount;
    }

    /// @notice Function to unlock xaver tokens. If tokens are still allocated to protocols they first hevae to be unallocated.  
    /// @param _user User address to which the xaver tokens are transferred from this contract.
    /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
    /// @param _lockedTokenAmount Amount of xaver tokens to lock inside this contract.
    function unlockTokensFromBasket(address _user, uint256 _basketId, uint256 _lockedTokenAmount) internal onlyBasketOwner(_basketId) {
        require(baskets[_basketId].nrOfAllocatedTokens >= _lockedTokenAmount, "Not enough unallocated tokens in basket");

        uint256 balanceBefore = IERC20(xaverTokenAddress).balanceOf(address(this));
        IERC20(xaverTokenAddress).safeTransfer(_user, _lockedTokenAmount);
        uint256 balanceAfter = IERC20(xaverTokenAddress).balanceOf(address(this));
        require((balanceBefore - balanceAfter - _lockedTokenAmount) == 0, "Error unlock: under/overflow");

        baskets[_basketId].nrOfAllocatedTokens -= _lockedTokenAmount;
    }

    // rebalances an existing Basket
    function rebalanceBasket(uint256 _ETFnumber, uint256 _basketId, uint256[] memory _allocations) public {
        require(ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");

        baskets[_basketId].latestAdjustmentPeriod = IETFVault(ETFVaults[_ETFnumber]).rebalancingPeriod() + 1;
        
        uint256 totalNewAllocatedTokens = 0;
        int256 deltaAllocation;
        for (uint256 i = 0; i < _allocations.length; i++) {
            totalNewAllocatedTokens += _allocations[i];
            if (baskets[_basketId].allocations[i] == _allocations[i]) continue;
            deltaAllocation = int256(_allocations[i] - baskets[_basketId].allocations[i]);
            IETFVault(ETFVaults[_ETFnumber]).setDeltaAllocations(i, deltaAllocation);
            baskets[_basketId].allocations[i] = _allocations[i];
        }

        if (baskets[_basketId].nrOfAllocatedTokens > totalNewAllocatedTokens) unlockTokensFromBasket(msg.sender, _basketId, baskets[_basketId].nrOfAllocatedTokens - totalNewAllocatedTokens);
        else if (baskets[_basketId].nrOfAllocatedTokens < totalNewAllocatedTokens) lockTokensToBasket(msg.sender, _basketId, totalNewAllocatedTokens - baskets[_basketId].nrOfAllocatedTokens);

        addToTotalRewards(_basketId);
    }

    // // redeem funds from basket
    // function redeemRewards(uint256 _basketId, uint256 _amount) public {
    //     require(IBasketToken(basketTokenAddress).ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");
    //     require(baskets[_basketId].totalUnRedeemedRewards >= _amount, "Not enough rewards in your basket");

    //     baskets[_basketId].totalRedeemedRewards += _amount;
    //     baskets[_basketId].totalUnRedeemedRewards -= _amount;

    //     transferRewards();
    // }

    // function transferRewards() private {

    // }

    function calculateBasketPrice() internal {
        uint256 price = 0;
        
    }

    // add to total rewards, formula of calculating the game rewards here
    function addToTotalRewards(uint256 _basketId) internal {
        baskets[_basketId].lastBasketPrice = 1;
        uint256 amount = 0;

        baskets[_basketId].totalUnRedeemedRewards += amount;
    }
}
