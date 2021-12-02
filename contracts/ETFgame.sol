// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IETFGame.sol";

import "./XaverToken.sol";

/** One contract is going to be created which is central to the ETF management game.
 * ETFs can be added here.
 * A player can create a Basket where he can allocate his xaver tokens to different protocols
 * Allocations are tracked per period, a period is n nr of blocks.
 * If a user rebalances his allocations then the performance over the last x active periods is measured
 * and stored on a per token basis in averagePastPerformance.
 * Redeeming (part) of the xaver tokens is the same as rebalancing and then taking out the xaver tokens plus earnings. 
 */
abstract contract ETFGame is XaverToken {
    // latest basket id
    uint256 private _latestBasketId;

    // latest ETFnumber
    uint32 public latestETFNumber;

    // maps the ETF number to the vault address of the ETF
    mapping(uint32 => address) public ETFvaults;

    struct Basket {
        // the ETF number for which this Basket was created
        uint32 ETFnumber;

        // last period when this Basket got rebalanced
        uint32 latestAdjustmentPeriod;

        // first period when this Basket started allocating
        uint32 firstAllocationPeriod;

        // average performance per token from firstAllocationPeriod until latest adjustment period
        uint256 averagePastPerformancePerToken;

        // average number of tokens allocated by basket from firstAllocationPeriod until latest adjustment period
        uint256 averageNrOfTokensAllocated;

        // nr of total allocated tokens 
        uint256 totalAllocatedTokens;

        // allocations per period
        mapping(uint32 => uint256) allocations;
    }

    // baskets 
    mapping(uint256 => Basket) private _baskets;

    // baskets latest performance per token
    function basketsLatestPerformancePerToken() public view returns(uint256) {

    }

    // add a new ETF
    function addETF() public {

    }

    // mints a new NFT with a Basket of allocations
    function mintNewBasket(uint32 ETFnumber) public {

    }

    // rebalances an existing Basket
    function rebalanceExistingBasket(uint256 basketId) public {

    }

    // redeem funds from basket
    function redeemFromBasket(uint256 basketId) public {

    }

    // adjusts the deltaAllocations in the ETF vault
    function _adjustDeltaAllocations(uint32 ETFnumber) private {

    }

}
