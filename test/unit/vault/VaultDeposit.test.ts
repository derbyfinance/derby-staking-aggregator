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
      await vault.connect(user).depositRequest(parseEther(100_000));
      
      expect(await vault.connect(user).getDepositRequest()).to.be.equal(parseEther(100_000));
      expect(await IDAI.balanceOf(vault.address)).to.be.equal(parseEther(100_000));
    });

    it('Deposit a second time before rebalance', async function () {
      await vault.connect(user).depositRequest(parseEther(50_000));
      
      expect(await vault.connect(user).getDepositRequest()).to.be.equal(parseEther(150_000));
      expect(await vault.getTotalDepositRequestsTest()).to.be.equal(parseEther(150_000));
      expect(await IDAI.balanceOf(vault.address)).to.be.equal(parseEther(150_000));
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
      await vault.connect(user).depositRequest(parseEther(10_000));

      await vault.connect(user).cancelDepositRequest();

      expect(await vault.getTotalDepositRequestsTest()).to.be.equal(0);

    it('Test training state', async function () {
      const { vault, user, guardian } = await setupVault();

      await vault.connect(guardian).setTraining(true);
      // set maxTrainingDeposit to 10k
      await vault.connect(guardian).setTrainingDeposit(parseEther(10_000));

      // not whitelisted
      await expect(vault.connect(user).depositRequest(parseEther(5_000))).to.be.revertedWith('');

      await vault.connect(guardian).addToWhitelist(user.address);

      await vault.connect(user).depositRequest(parseEther(6_000));

      expect(await vault.connect(user).getDepositRequest()).to.be.equal(parseEther(6_000));

      // min deposit of 100 not reached
      await expect(vault.connect(user).depositRequest(95 * 1e6)).to.be.revertedWith('Minimum deposit');

      // max deposit of 10k reached
      await expect(vault.connect(user).depositRequest(parseEther(6_000))).to.be.revertedWith('');

      // User will have a total of 9k LPs, so should be fine
      await vault.connect(user).depositRequest(parseEther(3_000));
    });
  });

  describe('Testing vault direct deposits, unit test', async () => {
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


      await vault.connect(user).deposit(parseEther(10_000));

      //LP token has 6 decimals
      expect(await vault.balanceOf(user.address)).to.be.equal('10000000000');

      let totalUnderlying = BigNumber.from('0');
      for (const protocol of allDAIVaults.values()) {
        const balanceUnderlying = await protocol.balanceUnderlying(vault);
        totalUnderlying = totalUnderlying.add(balanceUnderlying);
      }

      expect(totalUnderlying).to.be.closeTo(parseEther(10_000), parseEther(1));
      await vault.connect(user).withdraw(parseEther(10_000));
      totalUnderlying = BigNumber.from('0');
      for (const protocol of allDAIVaults.values()) {
        const balanceUnderlying = await protocol.balanceUnderlying(vault);
        expect(balanceUnderlying).to.be.closeTo('0', parseEther(1));
        totalUnderlying = totalUnderlying.add(balanceUnderlying);
      }
      expect(totalUnderlying).to.be.closeTo('0', parseEther(1));
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

      await vault.connect(user).deposit(parseEther(10_000));

      //LP token has 6 decimals
      expect(await vault.balanceOf(user.address)).to.be.equal('10000000000');

      let exchangeRate = await vault.calculateExchangeRate(parseEther(10_000));
      expect(exchangeRate).to.be.equal(parseEther(1));
      exchangeRate = await vault.calculateExchangeRate(parseEther(100_000));
      expect(exchangeRate).to.be.equal(parseEther(10));
      exchangeRate = await vault.calculateExchangeRate(parseEther(505_000));
      expect(exchangeRate).to.be.equal(parseEther(50.5));
    });
  });
});
});
