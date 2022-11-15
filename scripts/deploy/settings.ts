import { usdc } from '@testhelp/addresses';
import deployed from './deployedAddresses.json';

export const general = {
  addressfile: 'scripts/deploy/deployedAddresses.json',
};

export const vaultSettings = {
  name: 'DerbyUSDC',
  symbol: 'dfUSDC',
  decimals: 6,
  vaultNumber: 0,
  daoAddress: deployed.game,
  game: deployed.game,
  vaultCurrency: usdc,
  uScale: 1e6,
  gasFeeLiq: 10_000 * 1e6,
};
