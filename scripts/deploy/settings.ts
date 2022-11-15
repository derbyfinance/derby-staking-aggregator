import { usdc } from '@testhelp/addresses';

export const general = {
  addressfile: 'scripts/deploy/deployedAddresses.json',
};

export const vaultDeploySettings = {
  name: 'DerbyUSDC',
  symbol: 'dfUSDC',
  decimals: 6,
  vaultNumber: 0,
  vaultCurrency: usdc,
  uScale: 1e6,
  gasFeeLiq: 10_000 * 1e6,
};
