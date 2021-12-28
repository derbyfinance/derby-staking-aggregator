// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "./Interfaces/IProvider.sol";

contract Router {
    mapping(uint256 => mapping(uint256 => address)) public protocols; 

    function deposit(uint256 ETFnumber, uint256 protocolNumber, uint256 amount) external returns(uint256){
        return IProvider(protocols[ETFnumber][protocolNumber]).deposit(amount);
    }

    function withdraw(uint256 ETFnumber, uint256 protocolNumber, uint256 balance) external{
        return IProvider(protocols[ETFnumber][protocolNumber]).withdraw(balance);
    }

    function exchangeRate(uint256 ETFnumber, uint256 protocolNumber) external view returns(uint256){
        return IProvider(protocols[ETFnumber][protocolNumber]).exchangeRate();
    }

    function addProtocol
}