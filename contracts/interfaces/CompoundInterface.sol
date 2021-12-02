// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ICERC20.sol";

contract CompoundInterface {
    ICERC20 public CToken;
    IERC20 public vaultToken;

    constructor(address CToken_, address vaultToken_){
        CToken = ICERC20(CToken_);
        vaultToken = IERC20(vaultToken_);
    }

    function deposit(uint256 amount) external returns(uint256){
        vaultToken.approve(address(CToken), amount);
        uint mintResult =  CToken.mint(amount);
        return mintResult;
    }

    function withdraw(uint256 balance) external{

    }

    function exchangeRate() external view returns(uint256){

    }
}