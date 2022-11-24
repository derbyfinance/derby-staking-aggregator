import { IDeployVault } from '@testhelp/deployInterfaces';

export const general = {
  addressfile: 'scripts/deploy/helpers/deployedAddresses.json',
};

export const derbyTokenSettings = {
  name: 'Derby Finance',
  symbol: 'DRB',
  totalSupply: 100_000,
};

export const controllerInit = {
  dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  daiCurveIndex: 0,
  usdcCurveIndex: 1,
  usdtCurveIndex: 2,
  curve3PoolFee: 15, // 0.15% including slippage
  curve3Pool: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
  uniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  uniswapQouter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  uniswapPoolFee: 3000,
  chainlinkGasPriceOracle: '0x169E633A2D1E6c10dD91238Ba11c4A708dfEF37C',
};

export const vaultDeploySettings: IDeployVault = {
  name: 'DerbyUSDC',
  symbol: 'dfUSDC',
  decimals: 6,
  vaultNumber: 0,
  vaultCurrency: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  uScale: 1e6,
  gasFeeLiq: 10_000 * 1e6,
};

export const gameDeploySettings = {
  nftName: 'DerbyNFT',
  nftSymbol: 'DRBNFT',
  negativeRewardFactor: 50,
  negativeRewardThreshold: -50_000,
};

export const xChainControllerDeploySettings = {
  homeChainId: 100,
};

export const xProviderDeploySettings = {
  layerZeroEndpoint: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // dummy
  connextHandler: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // dummy
  homeChainId: 100,
};
