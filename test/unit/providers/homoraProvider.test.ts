import { expect } from 'chai';
import { BigNumber, Contract, Signer } from 'ethers';
import { deployments } from 'hardhat';
import {
  erc20,
  formatUSDC,
  getDAISigner,
  parseEther,
  formatEther,
  transferAndApproveUSDC,
} from '@testhelp/helpers';
import type { HomoraProvider, YearnProvider, YearnVaultMock } from '@typechain';
import { dai, usdc, homoraUSDC as hUSDC, homoraDAI as hDAI } from '@testhelp/addresses';
import { deployYearnMockVaults, getAllSigners, getContract } from '@testhelp/getContracts';

describe.skip('Testing Homora provider', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['HomoraProvider']);
    const provider = (await getContract('HomoraProvider', hre)) as HomoraProvider;
    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);

    // approve and send DAI to user
    const daiAmount = parseEther(1_000_000);
    const daiSigner = await getDAISigner();
    const IDAI = erc20(dai);
    await IDAI.connect(daiSigner).transfer(user.getAddress(), daiAmount);
    await IDAI.connect(user).approve(provider.address, daiAmount);

    return { provider, user };
  });

  describe.only('Testing homoraUSDC', () => {
    let provider: HomoraProvider, user: Signer, exchangeRate: BigNumber;
    const IUSDc: Contract = erc20(usdc);
    const IhUSDC: Contract = erc20(hUSDC);
    const amount = 100_000 * 1e6;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(hUSDC);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in hUSDC', async () => {
      const expectedShares = Math.round(amount / Number(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, hUSDC, usdc)).to.changeTokenBalance(
        IUSDc,
        user,
        -amount,
      );

      const hUSDCBalance = await provider.balance(user.address, hUSDC);
      expect(formatUSDC(hUSDCBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, hUSDC);

      const hUSDCBalance = await provider.balance(user.address, hUSDC);
      expect(formatUSDC(hUSDCBalance)).to.be.closeTo(formatUSDC(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, hUSDC);

      expect(formatUSDC(balanceUnderlying)).to.be.closeTo(amount / 1e6, 1);
    });

    it('Should be able to withdraw', async () => {
      const hUSDCBalance = await provider.balance(user.address, hUSDC);

      await IhUSDC.connect(user).approve(provider.address, hUSDCBalance);

      await expect(() =>
        provider.connect(user).withdraw(hUSDCBalance, hUSDC, usdc),
      ).to.changeTokenBalance(IUSDc, user, amount - 1);
    });
  });

  describe('Testing homoraDAI', () => {
    let provider: HomoraProvider, user: Signer, exchangeRate: BigNumber;
    const IDAI: Contract = erc20(dai);
    const IhDAI: Contract = erc20(hDAI);
    const amount = parseEther(100_000);

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(hDAI);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in hDAI', async () => {
      const expectedShares = Math.round(amount.div(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, hDAI, dai)).to.changeTokenBalance(
        IDAI,
        user,
        parseEther(-100_000),
      );

      const hDAIBalance = await provider.balance(user.address, hDAI);
      expect(formatEther(hDAIBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, hDAI);

      const hDAIBalance = await provider.balance(user.address, hDAI);
      expect(formatEther(hDAIBalance)).to.be.closeTo(formatEther(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, hDAI);

      expect(formatEther(balanceUnderlying)).to.be.closeTo(formatEther(amount), 1);
    });

    it('Should be able to withdraw', async () => {
      const hDAIBalance = await provider.balance(user.address, hDAI);

      await IhDAI.connect(user).approve(provider.address, hDAIBalance);

      await expect(() =>
        provider.connect(user).withdraw(hDAIBalance, hDAI, dai),
      ).to.changeTokenBalance(IDAI, user, amount.sub(1)); // close to, 1
    });
  });
});
