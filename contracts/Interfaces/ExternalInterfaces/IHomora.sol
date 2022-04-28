// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IHomora {

  function deposit(uint _amount) external;

  function withdraw(uint _amount) external;

  // function pricePerShare() external view returns(uint);

  function balanceOf(address _address) external view returns(uint);

  function transfer(address _receiver, uint _amount) external returns(bool);

  function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}