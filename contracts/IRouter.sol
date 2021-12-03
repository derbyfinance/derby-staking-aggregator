// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

interface IRouter {
    function deposit(uint32 ETFnumber, uint32 protocolNumber, uint256 amount) external returns(uint256);

    function withdraw(uint32 ETFnumber, uint32 protocolNumber, uint256 balance) external;

    function exchangeRate(uint32 ETFnumber, uint32 protocolNumber) external view returns(uint256);
}