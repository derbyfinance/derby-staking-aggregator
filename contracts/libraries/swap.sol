// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../Interfaces/ExternalInterfaces/ISwapRouter.sol";
import "../Interfaces/ExternalInterfaces/IUniswapV3Factory.sol";
import "../Interfaces/ExternalInterfaces/IUniswapV3Pool.sol";
import "../Interfaces/ExternalInterfaces/IStableSwap3Pool.sol";

import "hardhat/console.sol";

library Swap {
  using SafeERC20 for IERC20;

  address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  /// @notice Swap stable coins on Curve
  /// @param _amount Number of tokens to swap
  /// @param _tokenIn Token to sell
  /// @param _curve3Pool Curve pool address
  /// @param _indexTokenIn Curve pool index number of TokenIn address
  /// @param _indexTokenOut Curve pool index number of TokenOut address
  function swapStableCoins(
    uint256 _amount, 
    address _tokenIn, 
    address _curve3Pool,
    int128 _indexTokenIn,
    int128 _indexTokenOut
  ) internal {
    // uint256 daiScale = 1E18;
    // uint256 usdcScale = 1E6;
    // uint256 usdtScale = 1E6;

    uint256 fee = 5; // 0.05%    
    // Amount out 0 for now, will calc later          
    uint256 amountOutMin = 0;
    // uint256 amountOutMin = (_amount * (10000 - fee) / 10000) * daiScale / usdcScale;

    IERC20(_tokenIn).safeIncreaseAllowance(_curve3Pool, _amount);

    IStableSwap3Pool(_curve3Pool).exchange(
      _indexTokenIn, 
      _indexTokenOut, 
      _amount, 
      amountOutMin
    );
  }

  /// @notice Swap tokens on Uniswap
  /// @param _amount Number of tokens to sell
  /// @param _tokenIn Token to sell
  /// @param _tokenOut Token to receive
  /// @return Amountout Number of tokens received
  function swapTokensMulti(
    uint256 _amount, 
    address _tokenIn, 
    address _tokenOut,
    address _uniswapRouter,
    uint24 _poolFee
  ) internal returns(uint256) {
    IERC20(_tokenIn).safeIncreaseAllowance(_uniswapRouter, _amount);

    ISwapRouter.ExactInputParams memory params =
      ISwapRouter.ExactInputParams({
        path: abi.encodePacked(_tokenIn, _poolFee, WETH, _poolFee, _tokenOut),
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: _amount,
        amountOutMinimum: 0
      });

    uint256 amountOut = ISwapRouter(_uniswapRouter).exactInput(params);

    return amountOut;
  }

    // Not functional yet
  function getPoolAmountOut(
    uint256 _amount, 
    address _tokenIn, 
    address _tokenOut,
    address _uniswapFactory,
    uint24 _poolFee
  ) public view returns(uint256) {
    uint256 amountOut = 0;
    address pool = IUniswapV3Factory(_uniswapFactory).getPool(
      _tokenIn,
      _tokenOut,
      _poolFee
    );

    address token0 = IUniswapV3Pool(pool).token0();
    address token1 = IUniswapV3Pool(pool).token1();

    (uint256 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();

    if (token0 == _tokenOut) {
      amountOut =  (_amount * 2 ** 192 / sqrtPriceX96 ** 2) * 9970 / 10000;
    }
    if (token1 == _tokenOut) {
      amountOut =  (_amount * sqrtPriceX96 ** 2 / 2 ** 192) * 9970 / 10000;
    }

    console.log("pool %s", pool);
    console.log("token0 %s", token0);
    console.log("token1 %s", token1);
    console.log("sqrtPriceX96 %s", sqrtPriceX96);
    // console.log("amountOut pool %s", amountOut);

    return amountOut;
  }
}