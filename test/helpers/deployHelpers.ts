import { readFile } from 'fs/promises';
import { join } from 'path';

type IDeployConfig = {
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

export async function getDeployConfigVault(
  vaultName: string,
  network: string,
): Promise<IDeployConfig> {
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

export async function getConfig(network: string) {
  const path = join(__dirname, '..', '..', 'deploy', 'configs', `${network}.json`);
  return JSON.parse(await readFile(path, 'utf8'));
}
