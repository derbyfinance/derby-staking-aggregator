// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// Maybe this interface is not necesary
interface IBasketToken is IERC721 {
    function mint(address to, uint256 tokenId) external;

    function burn(uint256 tokenId) external;

    // function ownerOf(uint256 tokenId) external view returns (address);
}