import { usdc } from '@testhelp/addresses';
import { IDeployVault } from '@testhelp/deployInterfaces';

export const general = {
  addressfile: 'scripts/deploy/helpers/deployedAddresses.json',
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
