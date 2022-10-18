// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../Interfaces/ExternalInterfaces/ISwapRouter.sol";
import "../Interfaces/ExternalInterfaces/IUniswapV3Factory.sol";
import "../Interfaces/ExternalInterfaces/IUniswapV3Pool.sol";
import "../Interfaces/ExternalInterfaces/IStableSwap3Pool.sol";
import "../Interfaces/ExternalInterfaces/IWETH.sol";
import "../Interfaces/ExternalInterfaces/IQuoter.sol";

import "hardhat/console.sol";

library Swap {
  using SafeERC20 for IERC20;

  address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  uint256 internal constant gasUsedForSwap = 210000;

  /// @notice Swap stable coins on Curve
  /// @param _amount Number of tokens to swap
  /// @param _tokenIn Token to sell
  /// @param _tokenOut Token to receive
  /// @param _tokenInUScale Scale of tokenIn e.g 1E6
  /// @param _tokenOutUScale Scale of tokenOut e.g 1E6
  /// @param _indexTokenIn Curve pool index number of TokenIn address
  /// @param _indexTokenOut Curve pool index number of TokenOut address
  /// @param _curve3Pool Curve pool address
  /// @param _curvePoolFee Curve pool fee, in basis points, set in Router. 0.05% = 5
  function swapStableCoins(
    uint256 _amount,
    address _tokenIn,
    address _tokenOut,
    uint256 _tokenInUScale,
    uint256 _tokenOutUScale,
    int128 _indexTokenIn,
    int128 _indexTokenOut,
    address _curve3Pool,
    uint256 _curvePoolFee
  ) internal returns (uint256) {
    uint256 amountOutMin = (((_amount * (10000 - _curvePoolFee)) / 10000) * _tokenOutUScale) /
      _tokenInUScale;
    IERC20(_tokenIn).safeIncreaseAllowance(_curve3Pool, _amount);

    uint256 balanceBefore = IERC20(_tokenOut).balanceOf(address(this));

    IStableSwap3Pool(_curve3Pool).exchange(_indexTokenIn, _indexTokenOut, _amount, amountOutMin);

    uint256 balanceAfter = IERC20(_tokenOut).balanceOf(address(this));

    return balanceAfter - balanceBefore;
  }

  /// @notice Swap tokens on Uniswap
  /// @param _amount Number of tokens to sell
  /// @param _tokenIn Token to sell
  /// @param _tokenOut Token to receive
  /// @param _uniswapRouter Address of uniswapRouter
  /// @param _uniswapQuoter Address of uniswapQuoter
  /// @param _poolFee Current uniswap pool fee set in router e.g 3000
  /// @return Amountout Number of tokens received
  function swapTokensMulti(
    uint256 _amount,
    address _tokenIn,
    address _tokenOut,
    address _uniswapRouter,
    address _uniswapQuoter,
    uint24 _poolFee
  ) internal returns (uint256) {
    IERC20(_tokenIn).safeIncreaseAllowance(_uniswapRouter, _amount);

    uint256 amountOutMinimum = IQuoter(_uniswapQuoter).quoteExactInput(
      abi.encodePacked(_tokenIn, _poolFee, WETH, _poolFee, _tokenOut),
      _amount
    );

    ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
      path: abi.encodePacked(_tokenIn, _poolFee, WETH, _poolFee, _tokenOut),
      recipient: address(this),
      deadline: block.timestamp,
      amountIn: _amount,
      amountOutMinimum: amountOutMinimum
    });

    return ISwapRouter(_uniswapRouter).exactInput(params);
  }

  /// @notice Swap tokens on Uniswap
  /// @param _amount Number of tokens to sell
  /// @param _tokenIn Token to sell
  /// @param _tokenOut Token to receive
  /// @param _uniswapRouter Address of uniswapRouter
  /// @param _uniswapQuoter Address of uniswapQuoter
  /// @param _poolFee Current uniswap pool fee set in router e.g 3000
  /// @return Amountout Number of tokens received
  function swapTokensSingle(
    uint256 _amount,
    address _tokenIn,
    address _tokenOut,
    address _uniswapRouter,
    address _uniswapQuoter,
    uint24 _poolFee
  ) internal returns (uint256) {
    IERC20(_tokenIn).safeIncreaseAllowance(_uniswapRouter, _amount);

    uint256 amountOutMinimum = amountOutSingleSwap(
      _amount,
      _tokenIn,
      _tokenOut,
      _uniswapQuoter,
      _poolFee
    );

    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
      tokenIn: _tokenIn,
      tokenOut: _tokenOut,
      fee: _poolFee,
      recipient: address(this),
      deadline: block.timestamp,
      amountIn: _amount,
      amountOutMinimum: amountOutMinimum,
      sqrtPriceLimitX96: 0
    });

    // The call to `exactInputSingle` executes the swap.
    return ISwapRouter(_uniswapRouter).exactInputSingle(params);
  }

  /// @notice Swap tokens on Uniswap
  /// @param _amount Number of tokens to sell
  /// @param _tokenIn Token to sell
  /// @param _tokenOut Token to receive
  /// @param _uniswapQuoter Address of uniswapQuoter
  /// @param _poolFee Current uniswap pool fee set in router e.g 3000
  /// @return amountOutMin minimum amount out of tokens to receive when executing swap
  function amountOutSingleSwap(
    uint256 _amount,
    address _tokenIn,
    address _tokenOut,
    address _uniswapQuoter,
    uint24 _poolFee
  ) internal returns (uint256) {
    return IQuoter(_uniswapQuoter).quoteExactInputSingle(_tokenIn, _tokenOut, _poolFee, _amount, 0);
  }

  /// @notice Swap tokens on Uniswap Multi route
  /// @param _amount Number of tokens to sell
  /// @param _tokenIn Token to sell
  /// @param _tokenOut Token to receive
  /// @param _uniswapQuoter Address of uniswapQuoter
  /// @param _poolFee Current uniswap pool fee set in router e.g 3000
  /// @return amountOutMin minimum amount out of tokens to receive when executing swap
  function amountOutMultiSwap(
    uint256 _amount,
    address _tokenIn,
    address _tokenOut,
    address _uniswapQuoter,
    uint24 _poolFee
  ) internal returns (uint256) {
    return
      IQuoter(_uniswapQuoter).quoteExactInput(
        abi.encodePacked(_tokenIn, _poolFee, WETH, _poolFee, _tokenOut),
        _amount
      );
  }

  /// @notice Will unwrap WETH and send to DAO / governed address
  /// @param _governed DAO / governed address
  /// @param _amount amount to unwrap and transfer
  function unWrapWETHtoGov(address payable _governed, uint256 _amount) internal {
    IWETH9(WETH).withdraw(_amount);
    (bool sent, ) = _governed.call{value: _amount}("");
    require(sent, "Ether not sent");
  }
}
