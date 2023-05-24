import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import { erc20, parseUSDC } from '@testhelp/helpers';
import type { MainVaultMock, XChainControllerMock } from '@typechain';
import { usdc, starterProtocols as protocols } from '@testhelp/addresses';
import { setupXChain } from '../xController/setup';
import { ethers } from 'hardhat';

const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());

describe('Testing XChainController, unit test', async () => {
  let vault: MainVaultMock,
    xChainController: XChainControllerMock,
    user: Signer,
    guardian: Signer,
    IUSDc: Contract = erc20(usdc);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  before(async function () {
    const setup = await setupXChain();
    vault = setup.vault1;
    user = setup.user;
    guardian = setup.guardian;
    xChainController = setup.xChainController;
  });

  it('Testing vault rebalanceXChain', async function () {
    // Rebalancing the vault for setup funds in protocols
    await vault.setDeltaAllocationsReceivedTEST(true);
    await vault.connect(user).deposit(amountUSDC, user.address);

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40),
      yearnVault.setDeltaAllocation(vault, 20),
    ]);

    await vault.setVaultState(3);
    await vault.rebalance();

    // Testing rebalance X Chain function
    await vault.setVaultState(1);
    await vault.setAmountToSendXChainTEST(amountUSDC.div(2)); // 50k

    await xChainController.connect(guardian).setUnderlyingReceivedGuard(10, 4);

    await vault.rebalanceXChain({ value: ethers.utils.parseEther('0.1') });

    const balance = await IUSDc.balanceOf(xChainController.address);
    expect(balance).to.be.equal(amountUSDC.div(2).mul(9945).div(10_000)); // 50k - fee
  });
});
