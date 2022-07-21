// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./IXProviderMock.sol";

contract XSendMock {
    address public xprovider; // ConnextXProviderMock
    
    constructor(
        address _xprovider
    ){
        xprovider = _xprovider;
    }

    function xSendSomeValue(uint256 _value) external { // should later on be changed to onlyDao/ onlyKeeper
        IXProviderMock(xprovider).xSend(_value);
    }
}