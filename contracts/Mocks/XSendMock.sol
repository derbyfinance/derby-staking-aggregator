// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./Connext/interfaces/IXProviderMock.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract XSendMock {
    using SafeERC20 for IERC20;

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

    function xTransferFunds(address to, address asset, uint32 originDomain, uint32 destinationDomain, uint256 amount) external { // should later on be changed to onlyDao/ onlyKeeper
        IERC20 token = IERC20(asset);       
        token.approve(xprovider, amount);
        IXProviderMock(xprovider).xTransfer(to, asset, originDomain, destinationDomain, amount);
    }

    function setXProvider(address _xprovider) external onlyDao {
        xprovider = _xprovider;
    }
}