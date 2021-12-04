// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ICToken.sol";

contract CompoundInterface {
    ICToken public CToken;
    IERC20 public vaultCurrency;
    address public protocolToken;
    mapping(uint256 => uint256) public historicalPrices;

    function setCToken(address CTokenAddress) public {
        CToken = ICToken(CTokenAddress);
    }

    function setVaultCurrency(address vaultCurrencyAddress) public {
        vaultCurrency = IERC20(vaultCurrencyAddress);
    }

    function setProtocolToken(address protocolTokenAddress) public {
        protocolToken = protocolTokenAddress;
    }

    function addPricePoint() external {

    }

    function deposit(uint256 amount) external returns(uint256){
        vaultCurrency.approve(address(CToken), amount);
        uint mintResult =  CToken.mint(amount);
        return mintResult;
    }

    function withdraw(uint256 balance) external {

    }

    function exchangeRate() external view returns(uint256) {

    }

    function getHistoricalPrice(uint256 period) external view returns(uint256) {

    }
}