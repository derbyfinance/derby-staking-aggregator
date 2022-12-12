import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import { erc20, parseUSDC } from '@testhelp/helpers';
import type { MainVaultMock, XChainControllerMock } from '@typechain';
import { usdc, starterProtocols as protocols } from '@testhelp/addresses';
import { rebalanceETF } from '@testhelp/vaultHelpers';
import { setupVaultXChain } from './setup';

const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());

describe.only('Testing XChainController, unit test', async () => {
  let vault: MainVaultMock,
    xChainController: XChainControllerMock,
    user: Signer,
    IUSDc: Contract = erc20(usdc);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  before(async function () {
    const setup = await setupVaultXChain();
    vault = setup.vault;
    user = setup.user;
    xChainController = setup.xChainController;
  });

  it('Testing vault rebalanceXChain', async function () {
    // Rebalancing the vault for setup funds in protocols
    await vault.setDeltaAllocationsReceivedTEST(true);
    await vault.connect(user).deposit(amountUSDC);

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40),
      aaveVault.setDeltaAllocation(vault, 60),
      yearnVault.setDeltaAllocation(vault, 20),
    ]);

    await vault.setVaultState(3);
    await rebalanceETF(vault);

    // Testing rebalance X Chain function
    await vault.setVaultState(1);
    await vault.setAmountToSendXChainTEST(amountUSDC.div(2)); // 50k

    await vault.rebalanceXChain();

    const balance = await IUSDc.balanceOf(xChainController.address);
    expect(balance).to.be.equal(amountUSDC.div(2)); // 50k
  });
});
