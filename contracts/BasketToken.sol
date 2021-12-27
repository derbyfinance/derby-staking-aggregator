// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "./Interfaces/IBasketToken.sol";

contract BasketToken is IBasketToken, ERC721 {
    address public ETFgame;

    constructor(
        address ETFgame_,
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) {
        ETFgame = ETFgame_;
    }

    function mint(address to, uint256 tokenId) public override {
        require(msg.sender == ETFgame, "BT: mint not ETFgame");
        _mint(to, tokenId);
    }

    function burn(uint256 tokenId) public override {
        require(msg.sender == ETFgame, "BT: burn not ETFgame");
        _burn(tokenId);
    }
}