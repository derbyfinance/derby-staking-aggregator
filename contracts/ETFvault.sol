// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IETFVault.sol";
import "./IRouter.sol";
import "./IGoverned.sol";

import "./VaultToken.sol";

// ToDo: figure out when to transact from vault to protocols --> on rebalancing OR on vault funds treshhold?
// ToDo: how to do automatic yield farming? --> Swap in uniswap.

abstract contract ETFVault is VaultToken, IETFVault {
    // name of the ETF e.g. yield_defi_usd_low (a yield token ETF in DeFi in UDS with low risk) or yield_defi_btc_high or exchange_stocks_usd_mid
    bytes32 public ETFname;

    // ETF number
    uint256 public ETFnumber;

    // router address
    address public router;

    // vault currency token address (i.e. dai address)
    address public vaultCurrency;

    // address of ETFgame
    address public ETFgame;

    // address of DAO governance contract
    address public governed;

    modifier onlyETFgame {
        require(msg.sender == ETFgame, "ETFvault: only ETFgame");
        _;
    }

    modifier onlyDao {
        require(msg.sender == IGoverned(governed).dao(), "ETFvault: only DAO");
        _;
    }

    constructor(
        bytes32 ETFname_, 
        uint256 ETFnumber_, 
        address router_,
        address vaultCurrency_,
        address ETFgame_,
        address governed_,
        string memory name_,
        string memory symbol_
    ) VaultToken (name_, symbol_) {
        ETFname = ETFname_;
        ETFnumber = ETFnumber_;
        router = router_;
        vaultCurrency = vaultCurrency_;
        ETFgame = ETFgame_;
        governed = governed_;
    }

    // latest protocol id
    uint256 public latestProtocolId;

    // names of all the different protocols in the ETF
    mapping(uint256 => bytes32) public protocolNames;

    // period number of the latest rebalance
    uint256 public latestRebalancingPeriod;

    // from the rebalancing period to block number;
    mapping(uint256 => uint256) public rebalancingPeriodToBlock;

    // total number of allocated xaver tokens currently
    uint256 public totalAllocatedTokens;

    // current allocations over the protocols
    mapping(uint256 => uint256) private _currentAllocations;

    // delta of the total number of xaver tokens allocated on next rebalancing
    uint256 private _deltaAllocatedTokens;

    // delta of the portfolio on next rebalancing
    mapping(uint256 => uint256) private _deltaAllocations;

    function addProtocol(bytes32 name, address addr) public override onlyDao {

    }

    function _rebalanceETF() private {

    }

    function adjustDeltaAllocations() public onlyETFgame {

    }

    function adjustAllocatedTokens() public onlyETFgame {

    }
}