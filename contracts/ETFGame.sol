// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Interfaces/IETFGame.sol";
import "./Interfaces/IBasketToken.sol";
import "./Interfaces/IGoverned.sol";

import "./XaverToken.sol";

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

    constructor(address xaverTokenAddress_, address governed_){
        xaverTokenAddress = xaverTokenAddress_;
        governed = governed_;
    }

    modifier onlyDao {
        require(msg.sender == IGoverned(governed).dao(), "ETFvault: only DAO");
        _;
    }

    // latest basket id
    uint256 private _latestBasketId;

    // latest ETFnumber
    uint256 public latestETFNumber;

    // maps the ETF number to the vault address of the ETF
    mapping(uint256 => address) public ETFvaults;

    struct Basket {
        // the ETF number for which this Basket was created
        uint256 ETFnumber;

        // last period when this Basket got rebalanced
        uint256 latestAdjustmentPeriod;

        // first period when this Basket started allocating
        uint256 firstAllocationPeriod;

        // flag if it's the first period
        bool isFirst;

        // average performance per token from firstAllocationPeriod until latest adjustment period
        uint256 averagePastPerformancePerToken;

        // average number of tokens allocated by basket from firstAllocationPeriod until latest adjustment period
        uint256 averageNrOfTokensAllocated;

        // nr of total allocated tokens 
        uint256 totalAllocatedTokens;

        // allocations per period
        mapping(uint256 => uint256) allocations;
    }

    // setup the basket contract address
    function setupBasketContractAddress(address basketTokenAddress_) public onlyDao {
        basketTokenAddress = basketTokenAddress_;
    }

    // baskets 
    mapping(uint256 => Basket) private _baskets;

    // function to see the total number of allocated tokens. Only the owner of the basket can view this. 
    function basketTotalAllocatedTokens(uint256 basketId) public view returns(uint256){
        require(IBasketToken(basketTokenAddress).ownerOf(basketId) == msg.sender, "Not the owner of the Basket.");

        return _baskets[basketId].totalAllocatedTokens;
    }

    // function to see the allocation of a specific protocol in a basket. Only the owner of the basket can view this. 
    function basketAllocationInProtocol(uint256 basketId, uint256 protocolId) public view returns(uint256){
        require(IBasketToken(basketTokenAddress).ownerOf(basketId) == msg.sender, "Not the owner of the Basket.");

        return _baskets[basketId].allocations[protocolId];
    }

    // baskets latest performance per token
    function basketsLatestPerformancePerToken() public view returns(uint256) {

    }

    // add a new ETF
    function addETF() public {

    }

    // mints a new NFT with a Basket of allocations
    function mintNewBasket(uint256 ETFnumber) public {

    }

    // rebalances an existing Basket
    function rebalanceExistingBasket(uint256 basketId) public {

    }

    // redeem funds from basket
    function redeemFromBasket(uint256 basketId) public {

    }

    // adjusts the deltaAllocations in the ETF vault
    function _adjustDeltaAllocations(uint256 ETFnumber) private {

    }

}
