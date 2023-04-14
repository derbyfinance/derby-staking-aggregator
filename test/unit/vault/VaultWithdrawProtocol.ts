import { expect } from 'chai';
import { setupVault } from './setup';
import { erc20, getUSDCSigner, parseUSDC } from '@testhelp/helpers';
import { allProtocols, usdc } from '@testhelp/addresses';

describe('Testing Vault Deposit and withdraw in protocol, unit test', async () => {
  const yearnUSDC = allProtocols.get('yearn_usdc_01');
  // const yearnUSDC = allProtocols.get('compound_usdc_01');
  // const yearnUSDC = allProtocols.get('aave_usdc_01');
  // const yearnUSDC = allProtocols.get('truefi_usdc_01');
  // const yearnUSDC = allProtocols.get('idle_usdc_01');

  before(async () => {
    const { vault, user } = await setupVault();
  });

  it('D', async function () {
    const { vault, user } = await setupVault();
    await vault.connect(user).deposit(parseUSDC(100_000), user.address);

    await vault.depositInProtocolTest(yearnUSDC!.number, parseUSDC(10_000));
  });
});
