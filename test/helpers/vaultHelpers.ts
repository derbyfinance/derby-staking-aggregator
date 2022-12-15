import type { MainVaultMock } from '@typechain';
import { Result } from 'ethers/lib/utils';

export const vaultInfo = {
  name: 'DerbyUSDC',
  symbol: 'cUSDC',
  vaultNumber: 0,
  decimals: 6,
  uScale: 1e6,
  liquidityPerc: 10,
  gasFeeLiquidity: 10_000 * 1e6,
};

export const rebalanceETF = async (MainVaultMock: MainVaultMock) => {
  const tx = await MainVaultMock.rebalanceETF();
  const receipt = await tx.wait();
  const { gasInVaultCurrency } = receipt.events!.at(-1)!.args as Result;

  return gasInVaultCurrency;
};
