// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../VaultToken.sol";

contract CompoundVaultMock is VaultToken {
  using SafeERC20 for IERC20;

  uint256 public exchangeRate;
  address public underlying;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    address _vaultCurrency,
    uint256 _exchangeRate
  ) VaultToken(_name, _symbol, _decimals) {
    exchangeRate = _exchangeRate;
    underlying = _vaultCurrency;
  }

  function mint(uint256 _amount) external returns (uint256) {
    uint256 balanceBefore = getVaultBalance();
    IERC20(underlying).safeTransferFrom(msg.sender, address(this), _amount);
    uint256 balanceAfter = getVaultBalance();

    uint256 amount = balanceAfter - balanceBefore;
    uint256 shares = (amount * (10 ** decimals())) / exchangeRate;

    _mint(msg.sender, shares);

    return 0;
  }

  function redeem(uint256 _amount) external returns (uint256) {
    uint256 value = (_amount * exchangeRate) / (10 ** decimals());

    require(value > 0, "No value");
    require(getVaultBalance() >= value, "Not enough funds");

    _burn(msg.sender, _amount);
    IERC20(underlying).safeTransfer(msg.sender, value);

    return 0;
  }

  function exchangeRateStored() external view returns (uint256) {
    return exchangeRate;
  }

  function getVaultBalance() public view virtual returns (uint256) {
    return IERC20(underlying).balanceOf(address(this));
  }

  function setExchangeRate(uint256 _exchangeRate) external {
    exchangeRate = _exchangeRate;
  }
}
