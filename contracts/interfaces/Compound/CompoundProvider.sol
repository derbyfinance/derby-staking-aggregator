// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ICERC20.sol";

contract CompoundInterface {
    ICERC20 public CToken;
    IERC20 public vaultCurrency;
    address public protocolToken;
    mapping(uint32 => uint256) public historicalPrices;

    constructor(address CToken_, address vaultCurrency_, address protocolToken_){
        CToken = ICERC20(CToken_);
        vaultCurrency = IERC20(vaultCurrency_);
        protocolToken = protocolToken_;
    }

    function deposit(uint256 amount) external returns(uint256){
        vaultCurrency.approve(address(CToken), amount);
        uint mintResult =  CToken.mint(amount);
        return mintResult;
    }

    function withdraw(uint256 balance) external{

    }

    function exchangeRate() external view returns(uint256){

    }

    function addPricePoint() external {

    }

    function getHistoricalPrice(uint32 period) external view returns(uint256) {

    }
}