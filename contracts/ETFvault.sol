// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IETFVault.sol";
import "./IRouter.sol";

import "./VaultToken.sol";

abstract contract ETFVault is VaultToken, IETFVault {
    // name of the ETF e.g. yield_defi_usd_low (a yield token ETF in DeFi in UDS with low risk) or yield_defi_btc_high or exchange_stocks_usd_mid
    bytes32 public ETFname;

    // ETF number
    uint32 public ETFnumber;

    // latest protocol id
    uint32 public latestProtocolId;

    // router address
    address public router;

    // vault token address (i.e. dai address)
    address public vaultToken;

    constructor(
        bytes32 ETFname_, 
        uint32 ETFnumber_, 
        uint32 latestProtocolId_,  
        address router_,
        address vaultToken_,
        string memory name_,
        string memory symbol_
    ) VaultToken (name_, symbol_) {
        ETFname = ETFname_;
        ETFnumber = ETFnumber_;
        latestProtocolId = latestProtocolId_;
        router = router_;
        vaultToken = vaultToken_;
    }

    // names of all the different protocols in the ETF
    mapping(uint32 => bytes32) public protocolNames;

    // period number of the latest rebalance
    uint32 public latestRebalancingPeriod;

    // from the rebalancing period to block number;
    mapping(uint32 => uint256) public rebalancingPeriodToBlock;

    // total number of allocated xaver tokens currently
    uint256 public totalAllocatedTokens;

    // current allocations over the protocols
    mapping(uint32 => uint256) private _currentAllocations;

    // delta of the total number of xaver tokens allocated on next rebalancing
    uint256 private _deltaAllocatedTokens;

    // delta of the portfolio on next rebalancing
    mapping(uint32 => uint256) private _deltaAllocations;

    function addProtocol(bytes32 name, address addr) public override {

    }

    function _rebalanceETF() private {

    }
}