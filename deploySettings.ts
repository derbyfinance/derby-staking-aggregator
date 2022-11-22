import {
  ChainlinkGasPrice,
  curve3Pool,
  uniswapQuoter,
  uniswapRouter,
  usdc,
} from '@testhelp/addresses';
import { IDeployVault } from '@testhelp/deployInterfaces';
import { parseEther } from '@testhelp/helpers';

export const general = {
  addressfile: 'scripts/deploy/helpers/deployedAddresses.json',
};

export const derbyTokenSettings = {
  name: 'Derby Finance',
  symbol: 'DRB',
  totalSupply: parseEther('100000'), // 100k
};

export const vaultDeploySettings: IDeployVault = {
  name: 'DerbyUSDC',
  symbol: 'dfUSDC',
  decimals: 6,
  vaultNumber: 0,
  vaultCurrency: usdc,
  uScale: 1e6,
  gasFeeLiq: 10_000 * 1e6,
};

export const controllerDeploySettings = {
  curve3Pool,
  uniswapRouter,
  uniswapQuoter,
  poolFee: 3000,
  ChainlinkGasPrice,
};

export const gameDeploySettings = {
  nftName: 'DerbyNFT',
  nftSymbol: 'DRBNFT',
};

export const xChainControllerDeploySettings = {
  homeChainId: 100,
};

export const xProviderDeploySettings = {
  layerZeroEndpoint: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // dummy
  connextHandler: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // dummy
  homeChainId: 100,
};
