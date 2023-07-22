// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../Interfaces/IController.sol";

import "../Interfaces/ExternalInterfaces/ISwapRouter.sol";
import "../Interfaces/ExternalInterfaces/IWETH.sol";
import "../Interfaces/ExternalInterfaces/IQuoter.sol";

library Swap {
  using SafeERC20 for IERC20;

  struct SwapInOut {
    uint256 amount;
    uint256 deadline;
    uint256 amountOutMin;
    address nativeToken;
    address tokenIn;
    address tokenOut;
  }

  /// @notice Swap tokens on Uniswap
  /// @param _swap Number of tokens to sell, token to sell, token to receive
  /// @param _uniswap Address of uniswapRouter, uniswapQuoter and poolfee
  /// @return Amountout Number of tokens received
  function swapTokensMulti(
    SwapInOut memory _swap,
    IController.UniswapParams memory _uniswap,
    bool _rewardSwap
  ) public returns (uint256) {
    IERC20(_swap.tokenIn).safeIncreaseAllowance(_uniswap.router, _swap.amount);

    uint256 amountOutMinimum = IQuoter(_uniswap.quoter).quoteExactInput(
      abi.encodePacked(
        _swap.tokenIn,
        _uniswap.poolFee,
        _swap.nativeToken,
        _uniswap.poolFee,
        _swap.tokenOut
      ),
      _swap.amount
    );

    uint256 balanceBefore = IERC20(_swap.tokenOut).balanceOf(address(this));
    if (_rewardSwap && balanceBefore >= amountOutMinimum && amountOutMinimum >= _swap.amountOutMin)
      return amountOutMinimum;

    ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
      path: abi.encodePacked(
        _swap.tokenIn,
        _uniswap.poolFee,
        _swap.nativeToken,
        _uniswap.poolFee,
        _swap.tokenOut
      ),
      recipient: address(this),
      deadline: _swap.deadline,
      amountIn: _swap.amount,
      amountOutMinimum: _swap.amountOutMin
    });

    ISwapRouter(_uniswap.router).exactInput(params);
    uint256 balanceAfter = IERC20(_swap.tokenOut).balanceOf(address(this));
    require(balanceAfter - balanceBefore >= _swap.amountOutMin, "Over/underflow");

    return balanceAfter - balanceBefore;
  }

  /// @notice Swap tokens on Uniswap Multi route
  /// @param _swap Number of tokens to sell, token to sell, token to receive
  /// @param _uniswapQuoter Address of uniswapQuoter
  /// @param _poolFee Current uniswap pool fee set in router e.g 3000
  /// @return amountOutMin minimum amount out of tokens to receive when executing swap
  function amountOutMultiSwap(
    SwapInOut memory _swap,
    address _uniswapQuoter,
    uint24 _poolFee
  ) public returns (uint256) {
    return
      IQuoter(_uniswapQuoter).quoteExactInput(
        abi.encodePacked(_swap.tokenIn, _poolFee, _swap.nativeToken, _poolFee, _swap.tokenOut),
        _swap.amount
      );
  }
}
