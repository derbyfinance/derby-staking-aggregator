import { expect } from 'chai';
import { setupVault } from './setup';
import { VaultMock } from '@typechain';
import { Contract, Signer } from 'ethers';
import { parseUSDC } from '@testhelp/helpers';

describe('Testing VaultDeposit, unit test', async () => {
  let vault: VaultMock, user: Signer, IUSDC: Contract;
  before(async () => {
    ({ vault, user, IUSDC } = await setupVault());
  });

  it('Set and check deposit request', async function () {
    await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
      IUSDC,
      user,
      -10_000 * 1e6,
    );

    expect(await vault.connect(user).getDepositRequest()).to.be.equal(10_000 * 1e6);
    expect(await IUSDC.balanceOf(vault.address)).to.be.equal(10_000 * 1e6);
  });

  it('Deposit a second time before rebalance', async function () {
    await expect(() => vault.connect(user).deposit(5_000 * 1e6)).to.changeTokenBalance(
      IUSDC,
      user,
      -5_000 * 1e6,
    );

    expect(await vault.connect(user).getDepositRequest()).to.be.equal(15_000 * 1e6);
    expect(await vault.getTotalDepositRequestsTest()).to.be.equal(15_000 * 1e6);
    expect(await IUSDC.balanceOf(vault.address)).to.be.equal(15_000 * 1e6);
  });

  it('Redeem deposit before next rebalance', async function () {
    await expect(vault.connect(user).redeemDeposit()).to.be.revertedWith('No funds');
  });

  it('Redeem deposit after next rebalance', async function () {
    // mocking exchangerate to 2
    await vault.setExchangeRateTEST(parseUSDC(2));
    await vault.upRebalancingPeriodTEST();

    await expect(() => vault.connect(user).redeemDeposit()).to.changeTokenBalance(
      vault,
      user,
      (15_000 * 1e6) / 2,
    );

    expect(await vault.getTotalDepositRequestsTest()).to.be.equal(0);
  });

  it('Deposit and cancel request', async function () {
    await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
      IUSDC,
      user,
      -10_000 * 1e6,
    );

    await expect(() => vault.connect(user).cancelDepositRequest()).to.changeTokenBalance(
      IUSDC,
      user,
      10_000 * 1e6,
    );
  });

  it('Test training state', async function () {
    const { vault, user, guardian } = await setupVault();
    await vault.connect(guardian).setTraining(true);
    // set maxTrainingDeposit to 10k
    await vault.connect(guardian).setTrainingDeposit(10_000 * 1e6);

    // not whitelisted
    await expect(vault.connect(user).deposit(5_000 * 1e6)).to.be.revertedWith('');

    await vault.connect(guardian).addToWhitelist(user.address);

    await expect(() => vault.connect(user).deposit(6_000 * 1e6)).to.changeTokenBalance(
      IUSDC,
      user,
      -6_000 * 1e6,
    );
    expect(await vault.connect(user).getDepositRequest()).to.be.equal(6_000 * 1e6);

    // min deposit of 100 not reached
    await expect(vault.connect(user).deposit(95 * 1e6)).to.be.revertedWith('Minimum deposit');

    // max deposit of 10k reached
    await expect(vault.connect(user).deposit(6_000 * 1e6)).to.be.revertedWith('');

    // User will have a total of 9k LPs, so should be fine
    await expect(() => vault.connect(user).deposit(3_000 * 1e6)).to.changeTokenBalance(
      IUSDC,
      user,
      -3_000 * 1e6,
    );
  });
});
