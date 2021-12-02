// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

interface ICERC20 {
    function balanceOf(address owner) external view returns (uint);

    function mint(uint256) external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function redeem(uint) external returns (uint);
}