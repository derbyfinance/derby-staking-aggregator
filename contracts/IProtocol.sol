// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

interface IProtocol {
    function deposit(uint256 amount) external returns(uint256);

    function withdraw(uint256 balance) external;

    function exchangeRate() external view returns(uint256);
}