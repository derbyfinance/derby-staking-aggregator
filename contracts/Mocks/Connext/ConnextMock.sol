pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../Interfaces/ExternalInterfaces/IConnext.sol";

contract ConnextMock is IConnext {
  using SafeERC20 for IERC20;

  function xcall(
    uint32 _destination,
    address _to,
    address _asset,
    address _delegate,
    uint256 _amount,
    uint256 _slippage,
    bytes calldata _callData
  ) external payable returns (bytes32) {
    if (_asset != address(0)) IERC20(_asset).transferFrom(msg.sender, _to, _amount);
  }
}
