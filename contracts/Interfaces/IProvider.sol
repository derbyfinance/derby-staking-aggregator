// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IProvider {
    function deposit(address _buyer, uint256 _amount) external returns(uint256);

    function withdraw(address _seller, uint256 _amount) external returns(uint256);

    function exchangeRate() external view returns(uint256);

    function balanceUnderlying(address _address) external view returns(uint256);

    function calcShares(uint256 _amount) external view returns(uint256);

    function balance(address _address) external view returns(uint256);

    function addPricePoint() external;

    function getHistoricalPrice(uint256 period) external view returns(uint256);

    function protocolToken() external view returns(address);
}