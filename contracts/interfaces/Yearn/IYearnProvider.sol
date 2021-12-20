pragma solidity ^0.8.3;

interface IYearn {

  function deposit(uint _amount) external;

  function withdraw(uint _amount) external;

  function balanceOf(address _address) external view returns(uint);

  function getPricePerFullShare() external view returns(uint);
}