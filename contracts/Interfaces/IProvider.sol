// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IProvider {
    function deposit(address _buyer, uint256 _amount, address _uToken, address _protocolToken) external returns(uint256);

    function withdraw(address _seller, uint256 _amount, address _uToken, address _protocolToken) external returns(uint256);

    function exchangeRate(address _protocolToken) external view returns(uint256);

    function balanceUnderlying(address _address, address _protocolToken) external view returns(uint256);

    function calcShares(uint256 _amount, address _protocolToken) external view returns(uint256);

    function balance(address _address,address _protocolToken) external view returns(uint256);

    function addPricePoint() external;

    function getHistoricalPrice(uint256 _period) external view returns(uint256);

    function claim(address _protocolToken) external;
}