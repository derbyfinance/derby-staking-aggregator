import { readFile } from 'fs/promises';
import { join } from 'path';

type IDeployVaultConfig = {
  name: string;
  symbol: string;
  decimals: number;
  vaultNumber: number;
  vaultCurrency: string;
  uScale: number;
};

type IInitVaultConfig = {
  gasFeeLiq: number;
  rebalanceInterval: number;
  marginScale: number;
  liquidityPercentage: number;
  performanceFee: number;
  homeChain: number;
};

type IInitControllerConfig = {
  dai: string;
  usdc: string;
  usdt: string;
  daiCurveIndex: number;
  usdcCurveIndex: number;
  usdtCurveIndex: number;
  curve3PoolFee: number;
  curve3Pool: string;
  uniswapRouter: string;
  uniswapQouter: string;
  uniswapPoolFee: number;
  chainlinkGasPriceOracle: string;
};

export async function getDeployConfigVault(
  vaultName: string,
  network: string,
): Promise<IDeployVaultConfig> {
  const config = await getConfig(network);
  return config[vaultName]?.deploy;
}

export async function getInitConfigVault(
  vaultName: string,
  network: string,
): Promise<IInitVaultConfig> {
  const config = await getConfig(network);
  return config[vaultName]?.init;
}

export async function getDeployConfigController(network: string): Promise<IDeployVaultConfig> {
  const config = await getConfig(network);
  return config['Controller']?.deploy;
}

export async function getInitConfigController(network: string): Promise<IInitControllerConfig> {
  console.log(network);
  const config = await getConfig(network);
  return config['Controller']?.init;
}

export async function getConfig(network: string) {
  const path = join(__dirname, '..', '..', 'deploy', 'configs', `${network}.json`);
  return JSON.parse(await readFile(path, 'utf8'));
}
