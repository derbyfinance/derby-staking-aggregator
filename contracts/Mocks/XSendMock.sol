// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Connext/interfaces/IXProviderMock.sol";

contract XSendMock {
    address dao;
    address public xprovider; // ConnextXProviderMock

    modifier onlyDao {
      require(msg.sender == dao, "ConnextProvider: only DAO");
      _;
    }
    
    constructor(
        address _dao
    ){
        dao = _dao;
    }

    function xSendSomeValue(uint256 _value) external { // should later on be changed to onlyDao/ onlyKeeper
        IXProviderMock(xprovider).xSend(_value);
    }

    function setXProvider(address _xprovider) external onlyDao {
        xprovider = _xprovider;
    }
}