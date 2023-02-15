pragma solidity ^0.8.11;

import "../../Interfaces/ExternalInterfaces/IConnext.sol";

contract Connext is IConnext {
  function xcall(
    uint32 _destination,
    address _to,
    address _asset,
    address _delegate,
    uint256 _amount,
    uint256 _slippage,
    bytes calldata _callData
  ) external payable returns (bytes32) {}
}
