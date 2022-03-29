// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Interfaces/IETFGame.sol";
import "./Interfaces/IBasketToken.sol";
import "./Interfaces/IGoverned.sol";

/** One contract is going to be created which is central to the ETF management game.
 * ETFs can be added here.
 * A player can create a Basket where he can allocate his xaver tokens to different protocols
 * Allocations are tracked per period, a period is n nr of blocks.
 * If a user rebalances his allocations then the performance over the last x active periods is measured
 * and stored on a per token basis in averagePastPerformancePerToken.
 * Redeeming (part) of the xaver tokens is the same as rebalancing and then taking out the xaver tokens plus earnings. 
 */
abstract contract ETFGame {
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

    constructor(address _basketTokenAddress, address _xaverTokenAddress, address _governed){
        basketTokenAddress = _basketTokenAddress;
        xaverTokenAddress = _xaverTokenAddress;
        governed = _governed;
    }

    // latest basket id
    uint256 private latestBasketId;

    // latest ETFnumber
    uint256 public latestETFNumber;

    // maps the ETF number to the vault address of the ETF
    mapping(uint256 => address) public ETFvaults;

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
        uint256 totalAllocatedTokens;

        // allocations per period
        mapping(uint256 => uint256) allocations;
    }


    // function to see the total number of allocated tokens. Only the owner of the basket can view this. 
    function basketTotalAllocatedTokens(uint256 _basketId) public view returns(uint256){
        require(IBasketToken(basketTokenAddress).ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");

        return baskets[_basketId].totalAllocatedTokens;
    }

    // function to see the allocation of a specific protocol in a basket. Only the owner of the basket can view this. 
    function basketAllocationInProtocol(uint256 _basketId, uint256 _protocolId) public view returns(uint256){
        require(IBasketToken(basketTokenAddress).ownerOf(_basketId) == msg.sender, "Not the owner of the Basket.");

        return baskets[_basketId].allocations[_protocolId];
    }

    // add a new ETF
    function addETF() public onlyDao {

    }

    // mints a new NFT with a Basket of allocations
    function mintNewBasket(uint256 _ETFnumber) public {

    }

    // rebalances an existing Basket
    function rebalanceExistingBasket(uint256 _basketId) public {

    }

    // redeem funds from basket
    function redeemFromBasket(uint256 _basketId) public {

    }

    // adjusts the deltaAllocations in the ETF vault
    function adjustDeltaAllocations(uint256 _ETFnumber) private {

    }

}
