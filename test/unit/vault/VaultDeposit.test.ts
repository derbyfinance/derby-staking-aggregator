import { expect } from 'chai';
import { setupVault } from './setup';
import { VaultMock } from '@typechain';
import { Contract, Signer, BigNumber } from 'ethers';
import { parseEther } from '@testhelp/helpers';
import { allDAIVaults, dai } from '@testhelp/addresses';

describe('Testing Vault Deposits, unit test', async () => {
  let vault: VaultMock, user: Signer, IDAI: Contract;

  describe('Testing Vault Deposit Requests, unit test', async () => {
    before(async () => {
      ({ vault, user, IDAI } = await setupVault());
    });
    it('Set and check deposit request', async function () {
      const amountBN = BigNumber.from('100000000000000000000000');
      await vault.connect(user).depositRequest(amountBN);
      
      expect(await vault.connect(user).getDepositRequest()).to.be.equal(amountBN);
      expect(await IDAI.balanceOf(vault.address)).to.be.equal(amountBN);
    });

    it('Deposit a second time before rebalance', async function () {
      const amountBN1 = BigNumber.from('50000000000000000000000');
      const amountBN2 = BigNumber.from('150000000000000000000000');
      await vault.connect(user).depositRequest(amountBN1);
      
      expect(await vault.connect(user).getDepositRequest()).to.be.equal(amountBN2);
      expect(await vault.getTotalDepositRequestsTest()).to.be.equal(amountBN2);
      expect(await IDAI.balanceOf(vault.address)).to.be.equal(amountBN2);
    });

    it('Redeem deposit before next rebalance', async function () {
      await expect(vault.connect(user).redeemDeposit()).to.be.revertedWith('No funds');
    });

    it('Redeem deposit after next rebalance', async function () {
      // mocking exchangerate to 2
      await vault.setExchangeRateTEST(parseEther(2));
      await vault.upRebalancingPeriodTEST();

      await vault.connect(user).redeemDeposit();

      expect(await vault.getTotalDepositRequestsTest()).to.be.equal(0);
    });

    it('Deposit and cancel request', async function () {
      const amountBN = BigNumber.from('10000000000000000000000');
      await vault.connect(user).depositRequest(amountBN);

      await vault.connect(user).cancelDepositRequest();

      expect(await vault.getTotalDepositRequestsTest()).to.be.equal(0);

    it('Test training state', async function () {
      const { vault, user, guardian } = await setupVault();
      const amountBN1 = BigNumber.from('10000000000000000000000');
      const amountBN2 = BigNumber.from('5000000000000000000000');
      const amountBN3 = BigNumber.from('6000000000000000000000');
      const amountBN4 = BigNumber.from('3000000000000000000000');
      await vault.connect(guardian).setTraining(true);
      // set maxTrainingDeposit to 10k
      await vault.connect(guardian).setTrainingDeposit(amountBN1);

      // not whitelisted
      await expect(vault.connect(user).depositRequest(amountBN2)).to.be.revertedWith('');

      await vault.connect(guardian).addToWhitelist(user.address);

      await vault.connect(user).depositRequest(amountBN3);

      expect(await vault.connect(user).getDepositRequest()).to.be.equal(amountBN3);

      // min deposit of 100 not reached
      await expect(vault.connect(user).depositRequest(95 * 1e6)).to.be.revertedWith('Minimum deposit');

      // max deposit of 10k reached
      await expect(vault.connect(user).depositRequest(amountBN3)).to.be.revertedWith('');

      // User will have a total of 9k LPs, so should be fine
      await vault.connect(user).depositRequest(amountBN4);
    });
  });

  describe('Testing vault direct deposits, unit test', async () => {
    const amountBN1 = BigNumber.from('10000000000000000000000'); //10k
    const amountBN2 = BigNumber.from('100000000000000000000000'); //100k
    const amountBN3 = BigNumber.from('505000000000000000000000'); //505k
    const amountBN4 = BigNumber.from('50500000000000000000'); //5.05
    const precision = BigNumber.from('1000000000000000000'); //1e18
    const amountBN5 = BigNumber.from('10000000000000000000'); //1e19
    before(async () => {
      ({ vault, user, IDAI } = await setupVault());
    });
    it('Set and check direct deposit and withdraw', async function () {
      // set random allocations for all protocols
      const getRandomAllocation = () => Math.floor(Math.random() * 100_000) + 100_00;
      let totalAllocation = 0;
      for (const protocol of allDAIVaults.values()) {
        await protocol.setDeltaAllocation(vault, getRandomAllocation());
        totalAllocation += protocol.allocation;
      }
      await vault.setDeltaAllocationsReceivedTEST(true);
      await vault.rebalance();


      await vault.connect(user).deposit(amountBN1);

      //LP token has 6 decimals
      expect(await vault.balanceOf(user.address)).to.be.equal('10000000000');

      let totalUnderlying = BigNumber.from('0');
      for (const protocol of allDAIVaults.values()) {
        const balanceUnderlying = await protocol.balanceUnderlying(vault);
        totalUnderlying = totalUnderlying.add(balanceUnderlying);
      }

      expect(totalUnderlying).to.be.closeTo(amountBN1, precision);
      await vault.connect(user).withdraw(amountBN1);
      totalUnderlying = BigNumber.from('0');
      for (const protocol of allDAIVaults.values()) {
        const balanceUnderlying = await protocol.balanceUnderlying(vault);
        expect(balanceUnderlying).to.be.closeTo('0', precision);
        totalUnderlying = totalUnderlying.add(balanceUnderlying);
      }
      expect(totalUnderlying).to.be.closeTo('0', precision);
    });

    it('Test calculateExchangeRate function', async function () {
      // set random allocations for all protocols
      const getRandomAllocation = () => Math.floor(Math.random() * 100_000) + 100_00;
      let totalAllocation = 0;
      for (const protocol of allDAIVaults.values()) {
        await protocol.setDeltaAllocation(vault, getRandomAllocation());
        totalAllocation += protocol.allocation;
      }
      await vault.setDeltaAllocationsReceivedTEST(true);
      await vault.rebalance();

      await vault.connect(user).deposit(amountBN1);

      //LP token has 6 decimals
      expect(await vault.balanceOf(user.address)).to.be.equal('10000000000');

      let exchangeRate = await vault.calculateExchangeRate(amountBN1);
      expect(exchangeRate).to.be.equal(precision);
      exchangeRate = await vault.calculateExchangeRate(amountBN2);
      expect(exchangeRate).to.be.equal(amountBN5);
      exchangeRate = await vault.calculateExchangeRate(amountBN3);
      expect(exchangeRate).to.be.equal(amountBN4);
    });
  });
});
});
