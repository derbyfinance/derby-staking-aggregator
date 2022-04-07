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

  address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  address public constant Quoter = 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6;
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
  ) internal returns(uint256) {        
    uint256 amountOutMin = (_amount * (10000 - _curvePoolFee) / 10000) * _tokenOutUScale / _tokenInUScale;

    IERC20(_tokenIn).safeIncreaseAllowance(_curve3Pool, _amount);

    uint256 balanceBefore = IERC20(_tokenOut).balanceOf(address(this));
    
    IStableSwap3Pool(_curve3Pool).exchange(
      _indexTokenIn, 
      _indexTokenOut, 
      _amount, 
      amountOutMin
    );

    uint256 balanceAfter = IERC20(_tokenOut).balanceOf(address(this));

    return balanceAfter - balanceBefore;
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
    address _uniswapFactory,
    uint24 _poolFee,
    uint256 _swapFee
  ) internal returns(uint256) {
    IERC20(_tokenIn).safeIncreaseAllowance(_uniswapRouter, _amount);

    // uint256 amountOutWeth = getPoolAmountOut(_amount, _tokenIn, WETH, _uniswapFactory, _poolFee, _swapFee);
    // uint256 amountOutMin = getPoolAmountOut(amountOutWeth, WETH, _tokenOut, _uniswapFactory, _poolFee, _swapFee);

    console.log("before swap after amount out");
    ISwapRouter.ExactInputParams memory params =
      ISwapRouter.ExactInputParams({
        path: abi.encodePacked(_tokenIn, _poolFee, WETH, _poolFee, _tokenOut),
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: _amount,
        amountOutMinimum: 0 ///////////////////////////////
      });

    uint256 amountOut = ISwapRouter(_uniswapRouter).exactInput(params);

    console.log("tokens received swap %s", amountOut);

    return amountOut;
  }

  /// @notice Swap tokens on Uniswap
  /// @param _amount Number of tokens to sell
  /// @param _tokenIn Token to sell
  /// @param _tokenOut Token to receive
  /// @return Amountout Number of tokens received
  function swapTokensSingle(
    uint256 _amount, 
    address _tokenIn, 
    address _tokenOut,
    address _uniswapRouter,
    address _uniswapFactory,
    uint24 _poolFee,
    uint256 _swapFee
  ) internal returns(uint256) {
    IERC20(_tokenIn).safeIncreaseAllowance(_uniswapRouter, _amount);

    uint256 gasStart = gasleft();
    uint testQuote = IQuoter(Quoter).quoteExactInputSingle(
      _tokenIn, 
      _tokenOut, 
      _poolFee, 
      (1000 * 1E18),
      0
    );

    uint256 gasUsed = gasStart - gasleft();
    console.log("gasUsed %s", gasUsed); // 83323

    console.log("testQuote %s", testQuote);

    uint256 amountOutMinimum = getPoolAmountOut(_amount, _tokenIn, _tokenOut, _uniswapFactory, _poolFee, _swapFee);

    ISwapRouter.ExactInputSingleParams memory params =
      ISwapRouter.ExactInputSingleParams({
      tokenIn: _tokenIn,
      tokenOut: _tokenOut,
      fee: _poolFee,
      recipient: address(this),
      deadline: block.timestamp,
      amountIn: _amount,
      amountOutMinimum: testQuote, ///////////////////////
      sqrtPriceLimitX96: 0
    });

    // The call to `exactInputSingle` executes the swap.
    uint256 amountOut = ISwapRouter(_uniswapRouter).exactInputSingle(params);

    console.log("amount out swaptokensSingle %s", amountOut);

    // 46609277138914286139
    // 46609277138914286139

    return amountOut;
  }

  // Not functional yet
  function getPoolAmountOut(
    uint256 _amount, 
    address _tokenIn, 
    address _tokenOut,
    address _uniswapFactory,
    uint24 _poolFee,
    uint256 _fee
  ) internal view returns(uint256) {    
    uint256 amountOut = 0;
    address pool = IUniswapV3Factory(_uniswapFactory).getPool(
      _tokenIn,
      _tokenOut,
      _poolFee
    );

    address token0 = IUniswapV3Pool(pool).token0();
    address token1 = IUniswapV3Pool(pool).token1();

    (uint256 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();

    console.log("token0 %s", token0);
    console.log("token1 %s", token1);
    console.log("pool %s", pool);
    console.log("sqrtPriceX96 %s", sqrtPriceX96);
    // console.log("amount in %s", _amount);

    if (token0 == _tokenOut) {
      amountOut =  (_amount * 2 ** 192 / sqrtPriceX96 ** 2);
      amountOut =  (_amount * sqrtPriceX96 ** 2 / 2 ** 192);
    }
    // _amount * sqrtPriceX96 / (2 ** 96) = sqrt(price)
    // (sqrtPriceX96 / (2 ** 96)) ** 2 = price

    if (token1 == _tokenOut) {
      // console.log("price %s",  (sqrtPriceX96 ** 2 / 2 ** 192));
      // console.log("amountout2 %s",  * sqrtPriceX96 ** 2 / (2 ** 192));
      amountOut =  (((1000 * 1E18) ** 1/2) * sqrtPriceX96 / 2 ** 96);
      uint test = (1000 * 1E18) * sqrtPriceX96 / (2 ** 96);
      uint amountTest = test ** 2;

      console.log("test %s", test);
      console.log("amountTest %s", amountTest);
    }

    console.log("amountOut pool %s", amountOut);

    return amountOut;
  }
  // sqrt(token1/token0) Q64.96 value
  // 46609277138914286139 single swap COMP to Weth
  // 17201683616814690501220857580 sqrtPrice
  // 47139258168286336941658975345407373343449
  // 47139258168286336940
  // 217115771348574161893
  // 108557885674287080946
  function unWrapWETHtoGov(address payable _governed, uint256 _amount) internal {
    IWETH9(WETH).withdraw(_amount);
    _governed.transfer(_amount);
  }

}
// amountOut =  (_amount * 2 ** 192 / sqrtPriceX96 ** 2) * (10000 - _fee) / 10000;