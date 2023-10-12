import { expect } from 'chai';
import { setupVault } from './setup';
import { VaultMock } from '@typechain';
import { Contract, Signer } from 'ethers';
import { parseUSDC } from '@testhelp/helpers';
import { allProtocols, usdc } from '@testhelp/addresses';

describe('Testing Vault Deposits, unit test', async () => {
  let vault: VaultMock, user: Signer, IUSDC: Contract;

  describe('Testing Vault Deposit Requests, unit test', async () => {
    before(async () => {
      ({ vault, user, IUSDC } = await setupVault());
    });
    it('Set and check deposit request', async function () {
      await expect(() => vault.connect(user).depositRequest(10_000 * 1e6)).to.changeTokenBalance(
        IUSDC,
        user,
        -10_000 * 1e6,
      );

      expect(await vault.connect(user).getDepositRequest()).to.be.equal(10_000 * 1e6);
      expect(await IUSDC.balanceOf(vault.address)).to.be.equal(10_000 * 1e6);
    });

    it('Deposit a second time before rebalance', async function () {
      await expect(() => vault.connect(user).depositRequest(5_000 * 1e6)).to.changeTokenBalance(
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
      await expect(() => vault.connect(user).depositRequest(10_000 * 1e6)).to.changeTokenBalance(
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
      await expect(vault.connect(user).depositRequest(5_000 * 1e6)).to.be.revertedWith('');

      await vault.connect(guardian).addToWhitelist(user.address);

      await expect(() => vault.connect(user).depositRequest(6_000 * 1e6)).to.changeTokenBalance(
        IUSDC,
        user,
        -6_000 * 1e6,
      );
      expect(await vault.connect(user).getDepositRequest()).to.be.equal(6_000 * 1e6);

      // min deposit of 100 not reached
      await expect(vault.connect(user).depositRequest(95 * 1e6)).to.be.revertedWith('Minimum deposit');

      // max deposit of 10k reached
      await expect(vault.connect(user).depositRequest(6_000 * 1e6)).to.be.revertedWith('');

      // User will have a total of 9k LPs, so should be fine
      await expect(() => vault.connect(user).depositRequest(3_000 * 1e6)).to.changeTokenBalance(
        IUSDC,
        user,
        -3_000 * 1e6,
      );
    });
  });

  describe('Testing vault direct deposits, unit test', async () => {
    before(async () => {
      ({ vault, user, IUSDC } = await setupVault());
    });
    it('Set and check direct deposit and withdraw', async function () {
      // set random allocations for all protocols
      const getRandomAllocation = () => Math.floor(Math.random() * 100_000) + 100_00;
      let totalAllocation = 0;
      for (const protocol of allProtocols.values()) {
        await protocol.setDeltaAllocation(vault, getRandomAllocation());
        totalAllocation += protocol.allocation;
      }
      await vault.setDeltaAllocationsReceivedTEST(true);
      await vault.rebalance();

      await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
        IUSDC,
        user,
        -10_000 * 1e6,
      );

      expect(await vault.balanceOf(user.address)).to.be.equal(10_000 * 1e6);
      
      let totalUnderlying = 0;
      for (const protocol of allProtocols.values()) {
        const balanceUnderlying = await protocol.balanceUnderlying(vault);
        totalUnderlying += Number(balanceUnderlying);
      }
      expect(totalUnderlying).to.be.closeTo(10_000 * 1e6, 10_000);

      await expect(() => vault.connect(user).withdraw(10_000 * 1e6)).to.changeTokenBalance(
        vault,
        user,
        -10_000 * 1e6,
      );

      totalUnderlying = 0;
      for (const protocol of allProtocols.values()) {
        const balanceUnderlying = await protocol.balanceUnderlying(vault);
        expect(Number(balanceUnderlying)).to.be.closeTo(0, 10_000);
        totalUnderlying += Number(balanceUnderlying);
      }
      expect(totalUnderlying).to.be.closeTo(0, 10_000);
    });

    it('Test calculateExchangeRate function', async function () {
      // set random allocations for all protocols
      const getRandomAllocation = () => Math.floor(Math.random() * 100_000) + 100_00;
      let totalAllocation = 0;
      for (const protocol of allProtocols.values()) {
        await protocol.setDeltaAllocation(vault, getRandomAllocation());
        totalAllocation += protocol.allocation;
      }
      await vault.setDeltaAllocationsReceivedTEST(true);
      await vault.rebalance();

      await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
        IUSDC,
        user,
        -10_000 * 1e6,
      );

      expect(await vault.balanceOf(user.address)).to.be.equal(10_000 * 1e6);

      let exchangeRate = await vault.calculateExchangeRate(10_000 * 1e6);
      expect(exchangeRate).to.be.equal(1e6);
      exchangeRate = await vault.calculateExchangeRate(100_000 * 1e6);
      expect(exchangeRate).to.be.equal(1e7);
      exchangeRate = await vault.calculateExchangeRate(505_000 * 1e6);
      expect(exchangeRate).to.be.equal(5.05 * 1e7);
    });
  });
});

