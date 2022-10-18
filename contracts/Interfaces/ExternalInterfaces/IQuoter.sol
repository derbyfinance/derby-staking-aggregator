// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

/// @title Quoter Interface
/// @notice Supports quoting the calculated amounts from exact input or exact output swaps
/// @dev These functions are not marked view because they rely on calling non-view functions and reverting
/// to compute the result. They are also not gas efficient and should not be called on-chain.
interface IQuoter {
  /// @notice Returns the amount out received for a given exact input swap without executing the swap
  /// @param path The path of the swap, i.e. each token pair and the pool fee
  /// @param amountIn The amount of the first token to swap
  /// @return amountOut The amount of the last token that would be received
  function quoteExactInput(bytes memory path, uint256 amountIn)
    external
    returns (uint256 amountOut);

  /// @notice Returns the amount out received for a given exact input but for a swap of a single pool
  /// @param tokenIn The token being swapped in
  /// @param tokenOut The token being swapped out
  /// @param fee The fee of the token pool to consider for the pair
  /// @param amountIn The desired input amount
  /// @param sqrtPriceLimitX96 The price limit of the pool that cannot be exceeded by the swap
  /// @return amountOut The amount of `tokenOut` that would be received
  function quoteExactInputSingle(
    address tokenIn,
    address tokenOut,
    uint24 fee,
    uint256 amountIn,
    uint160 sqrtPriceLimitX96
  ) external returns (uint256 amountOut);
}
