// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/ICToken.sol";
import "../Interfaces/ExternalInterfaces/IComptroller.sol";
import "../Interfaces/IProvider.sol";

contract CompoundProvider is IProvider {
  using SafeERC20 for IERC20;

  address private dao;
  IComptroller public comptroller;

  // (vaultAddress => bool): true when address is whitelisted
  mapping(address => bool) public vaultWhitelist;

  modifier onlyDao() {
    require(msg.sender == dao, "Provider: only DAO");
    _;
  }

  modifier onlyVault() {
    require(vaultWhitelist[msg.sender] == true, "Provider: only Vault");
    _;
  }

  constructor(address _dao, address _comptroller) {
    dao = _dao;
    comptroller = IComptroller(_comptroller);
  }

  /// @notice Add protocol and vault to Controller
  /// @param _vault Vault address to whitelist
  function addVault(address _vault) external onlyDao {
    vaultWhitelist[_vault] = true;
  }

  /// @notice Getter for dao address
  function getDao() public view returns (address) {
    return dao;
  }

  /// @notice Deposit the underlying asset in Compound
  /// @dev Pulls underlying asset from Vault, deposit them in Compound, send cTokens back.
  /// @param _amount Amount to deposit
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Tokens received and sent to vault
  function deposit(
    uint256 _amount,
    address _cToken,
    address _uToken
  ) external override onlyVault returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    IERC20(_uToken).safeTransferFrom(msg.sender, address(this), _amount);
    IERC20(_uToken).safeIncreaseAllowance(_cToken, _amount);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    uint256 cTokenBefore = ICToken(_cToken).balanceOf(address(this));
    require(ICToken(_cToken).mint(_amount) == 0, "Error minting Compound");
    uint256 cTokenAfter = ICToken(_cToken).balanceOf(address(this));

    uint cTokensReceived = cTokenAfter - cTokenBefore;
    ICToken(_cToken).transfer(msg.sender, cTokensReceived);

    return cTokensReceived;
  }

  /// @notice Withdraw the underlying asset from Compound
  /// @dev Pulls cTokens from Vault, redeem them from Compound, send underlying back.
  /// @param _amount Amount to withdraw
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(
    uint256 _amount,
    address _cToken,
    address _uToken
  ) external override onlyVault returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(msg.sender);

    uint256 balanceBeforeRedeem = IERC20(_uToken).balanceOf(address(this));

    require(
      ICToken(_cToken).transferFrom(msg.sender, address(this), _amount) == true,
      "Error: transferFrom"
    );
    // Compound redeem: 0 on success, otherwise an Error code
    require(ICToken(_cToken).redeem(_amount) == 0, "Error: compound redeem");

    uint256 balanceAfterRedeem = IERC20(_uToken).balanceOf(address(this));
    uint256 uTokensReceived = balanceAfterRedeem - balanceBeforeRedeem;

    IERC20(_uToken).safeTransfer(msg.sender, uTokensReceived);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(msg.sender);
    require(
      (balanceAfter - balanceBefore - uTokensReceived) == 0,
      "Error Withdraw: under/overflow"
    );

    return uTokensReceived;
  }

  /// @notice Get balance from address in underlying token
  /// @param _address Address to request balance from, most likely a Vault
  /// @param _cToken Address of protocol LP Token eg cUSDC (only works if _cToken.decimals() = 8)
  /// @return balance in underlying token
  function balanceUnderlying(
    address _address,
    address _cToken
  ) public view override returns (uint256) {
    uint256 balanceShares = balance(_address, _cToken); // decimals = 8
    uint256 price = exchangeRate(_cToken); // decimals = 10 + vaultCurrency.decimals

    return (balanceShares * price) / 1e18;
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev returned price from compound is scaled https://compound.finance/docs/ctokens#exchange-rate
  /// @param _amount Amount in underyling token e.g USDC (decimals = vaultCurrency.decimals)
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens (decimals = 8)
  function calcShares(uint256 _amount, address _cToken) external view override returns (uint256) {
    uint256 shares = (_amount * 1e18) / exchangeRate(_cToken);
    return shares;
  }

  /// @notice Get balance of cToken from address
  /// @param _address Address to request balance from
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens (decimals = 8)
  function balance(address _address, address _cToken) public view override returns (uint256) {
    uint256 _balanceShares = ICToken(_cToken).balanceOf(_address);
    return _balanceShares;
  }

  /// @notice Exchange rate of underyling protocol token
  /// @dev returned price from compound is scaled https://compound.finance/docs/ctokens#exchange-rate
  /// @param _cToken Address of protocol LP Token eg cUSDC
  /// @return price of LP token (decimals = 10 + vaultCurrency.decimals)
  function exchangeRate(address _cToken) public view override returns (uint256) {
    uint256 _price = ICToken(_cToken).exchangeRateStored();
    return _price;
  }

  /// @dev Transfers a specified amount of tokens to a specified vault, used for getting rewards out.
  /// This function can only be called by the DAO.
  /// @param _token The address of the token to be transferred.
  /// @param _vault The address of the vault to receive the tokens.
  /// @param _amount The amount of tokens to be transferred.
  function sendTokensToVault(address _token, address _vault, uint256 _amount) external onlyDao {
    require(vaultWhitelist[_vault] == true, "Provider: Vault not known");
    IERC20(_token).safeTransfer(_vault, _amount);
  }

  /// @notice Claims/harvest COMP tokens from the Comptroller
  /// @param _cToken Address of protocol LP Token eg cUSDC
  function claim(address _cToken, address _claimer) external override onlyVault returns (bool) {
    address[] memory cTokens = new address[](1);
    cTokens[0] = _cToken;
    comptroller.claimComp(_claimer, cTokens);

    return true;
  }
}
