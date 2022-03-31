// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IETFVault.sol";

import "./Interfaces/IETFGame.sol";
import "./Interfaces/IBasketToken.sol";
import "./Interfaces/IGoverned.sol";
import "./XaverToken.sol";

contract ETFGame {
    using SafeERC20 for IERC20;
    
    // xaver token address
    address public xaverTokenAddress;

    // basket token address
    address public basketTokenAddress;

    // address of DAO governance contract
    address public governed;

    modifier onlyDao {
        require(msg.sender == governed, "ETFvault: only DAO");
        _;
    }

    constructor(address _xaverTokenAddress, address _governed){
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
    mapping(uint256 => mapping(uint256 => uint256)) public TVLperToken;

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

        // nr of locked tokens that are not allocated yet
        uint256 nrOfUnAllocatedTokens;

        // total build up rewards
        uint256 totalUnRedeemedRewards;

        // total redeemed rewards
        uint256 totalRedeemedRewards;

        // allocations per period
        mapping(uint256 => uint256) allocations;
    }

    // setup the basket contract address
    function setupBasketContractAddress(address _basketTokenAddress) public onlyDao {
        basketTokenAddress = _basketTokenAddress;
    }

    // function to see the total number of allocated tokens. Only the owner of the basket can view this. 
    function basketTotalAllocatedTokens(uint256 _basketId) public view returns(uint256){
        require(IBasketToken(basketTokenAddress).ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");

        return baskets[_basketId].nrOfAllocatedTokens;
    }

    // function to see the total number of unallocated tokens. Only the owner of the basket can view this. 
    function basketTotalUnAllocatedTokens(uint256 _basketId) public view returns(uint256){
        require(IBasketToken(basketTokenAddress).ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");

        return baskets[_basketId].nrOfUnAllocatedTokens;
    }

    // function to see the allocation of a specific protocol in a basket. Only the owner of the basket can view this. 
    function basketAllocationInProtocol(uint256 _basketId, uint256 _protocolId) public view returns(uint256){
        require(IBasketToken(basketTokenAddress).ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");

        return baskets[_basketId].allocations[_protocolId];
    }

    // add a new ETF
    function addETF(address _ETFVaultAddress) public onlyDao {
        ETFVaults[latestETFNumber] = _ETFVaultAddress;
        latestETFNumber++;
    }

    // mints a new NFT with a Basket of allocations
    function mintNewBasket(uint256 _ETFnumber, uint256 _lockedTokenAmount) public {
        // mint Basket with nrOfUnAllocatedTokens equal to _lockedTokenAmount
        IBasketToken(basketTokenAddress).mint(msg.sender, latestBasketId);
        baskets[latestBasketId].ETFnumber = _ETFnumber;
        baskets[latestBasketId].latestAdjustmentPeriod = IETFVault(ETFVaults[_ETFnumber]).rebalancingPeriod() + 1;
        
        lockTokensToBasket(latestBasketId, _lockedTokenAmount);
        latestBasketId++;
    }

    function lockTokensToBasket(uint256 _basketId, uint256 _lockedTokenAmount) public {
        require(IBasketToken(basketTokenAddress).ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");

        uint256 balanceBefore = IERC20(xaverTokenAddress).balanceOf(address(this));
        IERC20(xaverTokenAddress).safeTransfer(address(this), _lockedTokenAmount);
        uint256 balanceAfter = IERC20(xaverTokenAddress).balanceOf(address(this));
        require((balanceAfter - balanceBefore - _lockedTokenAmount) == 0, "Error lock: under/overflow");

        baskets[latestBasketId].nrOfUnAllocatedTokens += _lockedTokenAmount;
    }


    function unlockTokensFromBasket(uint256 _basketId, uint256 _lockedTokenAmount) public {
        require(IBasketToken(basketTokenAddress).ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");
        require(baskets[_basketId].nrOfUnAllocatedTokens >= _lockedTokenAmount, "Not enough unallocated tokens in basket");

        uint256 balanceBefore = IERC20(xaverTokenAddress).balanceOf(address(this));
        IERC20(xaverTokenAddress).safeTransferFrom(address(this), msg.sender,  _lockedTokenAmount);
        uint256 balanceAfter = IERC20(xaverTokenAddress).balanceOf(address(this));
        require((balanceAfter - balanceBefore - _lockedTokenAmount) == 0, "Error unlock: under/overflow");

        baskets[_basketId].nrOfUnAllocatedTokens -= _lockedTokenAmount;
    }

    // // rebalances an existing Basket
    // function rebalanceExistingBasket(uint256 _ETFnumber, uint256 _basketId, uint256[] memory _allocations) public {
    //     require(IBasketToken(basketTokenAddress).ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");

    //     addToTotalRewards(_basketId);
    //     baskets[_basketId].latestAdjustmentPeriod = IETFVault(ETFVaults[_ETFnumber]).rebalancingPeriod() + 1;
        
    //     uint256 totalNewAllocatedTokens = 0;
    //     uint256 totalOldAllocatedTokens = baskets[_basketId].nrOfUnAllocatedTokens + baskets[_basketId].nrOfAllocatedTokens;
    //     for (uint256 i = 0; i < _allocations.length; i++) {
    //         totalNewAllocatedTokens += _allocations[i];
    //         if (baskets[_basketId].allocations[i] == _allocations[i]) continue;
    //         uint256 deltaAllocation = _allocations[i] - baskets[_basketId].allocations[i];
    //         adjustDeltaAllocations(_ETFnumber, i, deltaAllocation);
    //         baskets[_basketId].allocations[i] = _allocations[i];
    //     }

    //     if (totalNewAllocatedTokens > totalOldAllocatedTokens) {
    //         uint256 lockedTokenAmount = totalNewAllocatedTokens - totalOldAllocatedTokens;
    //         lockTokensToBasket(_basketId, lockedTokenAmount);
    //         baskets[_basketId].nrOfUnAllocatedTokens = 0;
            
    //     } else {
    //         if (totalNewAllocatedTokens <= baskets[_basketId].nrOfUnAllocatedTokens) baskets[_basketId].nrOfUnAllocatedTokens -= totalNewAllocatedTokens;
    //         else baskets[_basketId].nrOfUnAllocatedTokens = 0;
    //     }
    //     baskets[_basketId].nrOfAllocatedTokens = totalNewAllocatedTokens;
    // }

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

    // // add to total rewards, formula of calculating the game rewards here
    // function addToTotalRewards(uint256 _basketId) private {
    //     baskets[_basketId].lastBasketPrice = 1;
    //     uint256 amount = 0;


    //     baskets[_basketId].totalUnRedeemedRewards += amount;
    // }

    // // adjusts the deltaAllocations in the ETF vault
    // function adjustDeltaAllocations(uint256 _ETFnumber, uint256 _protocolId, uint256 _deltaAllocation) private {

    // }

}
