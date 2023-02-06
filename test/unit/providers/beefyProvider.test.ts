import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { deployments } from 'hardhat';
import { erc20, transferAndApproveUSDC } from '@testhelp/helpers';
import type { BeefyProvider, YearnProvider } from '@typechain';
import { beefyUSDC, dai, usdc } from '@testhelp/addresses';
import { getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Beefy provider', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['BeefyProvider']);
    const provider = (await getContract('BeefyProvider', hre)) as YearnProvider;

    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);

    return { provider, user };
  });

  describe('Testing Beefy LP stargate USDC', () => {
    const IUSDc: Contract = erc20(usdc);
    const bUSDC: Contract = erc20(beefyUSDC);
    let provider: BeefyProvider, user: Signer;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      const exchangeRate = await provider.exchangeRate(beefyUSDC);
      console.log(exchangeRate);
      expect(exchangeRate).to.be.greaterThan(100);
    });

    it('Should deposit in beefyUSDC', async () => {
      await expect(() =>
        provider.connect(user).deposit(100_000 * 1e6, beefyUSDC, usdc),
      ).to.changeTokenBalance(bUSDC, user, 10);
    });

    // it('Should withdraw from VaultMock', async () => {
    //   // set exchangeRate to 2.5
    //   await yearnUSDC.setExchangeRate(2.5 * 1e6);

    //   await yearnUSDC.connect(user).approve(provider.address, 20_000 * 1e6);
    //   await expect(() =>
    //     provider.connect(user).withdraw(20_000 * 1e6, yearnUSDC.address, usdc),
    //   ).to.changeTokenBalance(IUSDc, user, 20_000 * 1e6 * 2.5);
    // });
  });
});
