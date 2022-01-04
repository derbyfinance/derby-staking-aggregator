pragma solidity ^0.8.3;

interface IAToken {

  function mint(
    address user,
    uint256 amount,
    uint256 index
  ) external returns (bool);

  function burn(
    address user,
    address receiverOfUnderlying,
    uint256 amount,
    uint256 index
  ) external;

  function scaledBalanceOf(address user) external view returns (uint256);

  function pricePerShare() external view returns(uint);

  function transfer(address _receiver, uint _amount) external returns(bool);
}