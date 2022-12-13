import { expect } from 'chai';
import { Contract } from 'ethers';
import { erc20, parseUSDC } from '@testhelp/helpers';
import { usdc, starterProtocols as protocols } from '@testhelp/addresses';
import { rebalanceETF } from '@testhelp/vaultHelpers';
import { setupVault } from './setup';

describe.only('Testing VaultWithdraw, unit test', async () => {
  const IUSDc: Contract = erc20(usdc);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  it('Should not be able to withdraw when vault is off', async function () {
    const { vault, user } = await setupVault();
    await vault.toggleVaultOnOffTEST(true);

    await expect(vault.connect(user).withdraw(1 * 1e6)).to.be.revertedWith('Vault is off');
    await vault.toggleVaultOnOffTEST(false);
  });

  it('Should be able to withdraw LP tokens from vault balance', async function () {
    const { vault, user } = await setupVault();
    // 100k USDC to vault
    await IUSDc.connect(user).transfer(vault.address, 100_000 * 1e6);
    // deposit 10k USDC
    await vault.connect(user).deposit(50_000 * 1e6);

    await expect(() => vault.connect(user).withdraw(10_000 * 1e6)).to.changeTokenBalance(
      IUSDc,
      user,
      10_000 * 1e6,
    );

    // mocking exchangerate to 1.05
    await vault.setExchangeRateTEST(1.05 * 1e6);

    let expectedUSDCReceived = 10_000 * 1.05 * 1e6;
    await expect(() => vault.connect(user).withdraw(10_000 * 1e6)).to.changeTokenBalance(
      IUSDc,
      user,
      expectedUSDCReceived,
    );

    // mocking exchangerate to 1.05
    await vault.setExchangeRateTEST(1.2 * 1e6);

    expectedUSDCReceived = 30_000 * 1.2 * 1e6;
    await expect(() => vault.connect(user).withdraw(30_000 * 1e6)).to.changeTokenBalance(
      IUSDc,
      user,
      expectedUSDCReceived,
    );
  });

  it('Should be able to withdraw LP tokens from vault balance and protocols', async function () {
    const { vault, user } = await setupVault();
    await vault.connect(user).deposit(100_000 * 1e6);

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40 * 1e6),
      aaveVault.setDeltaAllocation(vault, 60 * 1e6),
      yearnVault.setDeltaAllocation(vault, 20 * 1e6),
    ]);

    // mocking vault in correct state and exchangerate to 1.05
    await Promise.all([
      vault.setExchangeRateTEST(1.05 * 1e6),
      vault.setVaultState(3),
      vault.setDeltaAllocationsReceivedTEST(true),
    ]);
    await rebalanceETF(vault);
    await vault.setVaultState(0);

    await expect(vault.connect(user).withdraw(20_000 * 1e6)).to.be.revertedWith('!funds');
  });

  it('Should set withdrawal request and withdraw the allowance later', async function () {
    const { vault, user } = await setupVault();
    await vault.connect(user).deposit(parseUSDC('10000')); // 10k
    expect(await vault.totalSupply()).to.be.equal(parseUSDC('10000')); // 10k

    // mocking exchangerate to 0.9
    await vault.setExchangeRateTEST(parseUSDC('0.9'));

    // withdrawal request for more then LP token balance
    await expect(vault.connect(user).withdrawalRequest(parseUSDC('10001'))).to.be.revertedWith(
      'ERC20: burn amount exceeds balance',
    );

    // withdrawal request for 10k LP tokens
    await expect(() =>
      vault.connect(user).withdrawalRequest(parseUSDC('10000')),
    ).to.changeTokenBalance(vault, user, -parseUSDC('10000'));

    // check withdrawalAllowance user and totalsupply
    expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(parseUSDC('9000'));
    expect(await vault.totalSupply()).to.be.equal(parseUSDC('0'));

    // trying to withdraw allowance before the vault reserved the funds
    await expect(vault.connect(user).withdrawAllowance()).to.be.revertedWith('');

    // mocking vault settings
    await vault.upRebalancingPeriodTEST();
    await vault.setReservedFundsTEST(parseUSDC('10000'));

    // withdraw allowance should give 9k USDC
    await expect(() => vault.connect(user).withdrawAllowance()).to.changeTokenBalance(
      IUSDc,
      user,
      parseUSDC('9000'),
    );

    // trying to withdraw allowance again
    await expect(vault.connect(user).withdrawAllowance()).to.be.revertedWith('!allowance');
  });
});
