// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IETFVault {
    function addProtocol(bytes32 name, address addr) external;
}