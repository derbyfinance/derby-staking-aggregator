// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "./IProtocol.sol";

contract Router {
    mapping(uint32 => mapping(uint32 => address)) public protocols; 

    function deposit(uint32 ETFnumber, uint32 protocolNumber, uint256 amount) external returns(uint256){
        return IProtocol(protocols[ETFnumber][protocolNumber]).deposit(amount);
    }

    function withdraw(uint32 ETFnumber, uint32 protocolNumber, uint256 balance) external{
        return IProtocol(protocols[ETFnumber][protocolNumber]).withdraw(balance);
    }

    function exchangeRate(uint32 ETFnumber, uint32 protocolNumber) external view returns(uint256){
        return IProtocol(protocols[ETFnumber][protocolNumber]).exchangeRate();
    }
}