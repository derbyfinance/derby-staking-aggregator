import { expect } from 'chai';
import { BigNumber, Contract, Signer } from 'ethers';
import { deployments, network } from 'hardhat';
import { erc20, parseEther, formatEther, formatUnits } from '@testhelp/helpers';
import type { CompoundProvider, WombexProvider } from '@typechain';
import { dai, usdc, compoundUSDC as cUSDC, compoundDAI as cDAI } from '@testhelp/addresses';
import { getAllSigners, getContract } from '@testhelp/getContracts';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe.skip('Testing Compound provider', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['WombexProvider']);
    const provider = (await getContract('WombexProvider', hre)) as WombexProvider;
    const [dao, user] = await getAllSigners(hre);

    // await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);

    // approve and send DAI to user
    // const daiAmount = parseEther(1_000_000);
    // const daiSigner = await getDAISigner();
    // const IDAI = erc20(dai);
    // await IDAI.connect(daiSigner).transfer(user.getAddress(), daiAmount);
    // await IDAI.connect(user).approve(provider.address, daiAmount);

    return { provider, user };
  });

  describe('Testing WombexUSDC', () => {
    let provider: WombexProvider, user: Signer, exchangeRate: BigNumber;
    const IUSDc: Contract = erc20(usdc);
    const IcUSDC: Contract = erc20(cUSDC);
    const amount = 100_000 * 1e6;
    const decimals = 8;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      console.log(await time.latestBlock());
      // exchangeRate = await provider.exchangeRate(cUSDC);
      // expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    // it('Should deposit in cUSDC', async () => {
    //   const expectedShares = Math.round((amount * 1e12) / Number(exchangeRate));

    //   await expect(() => provider.connect(user).deposit(amount, cUSDC, usdc)).to.changeTokenBalance(
    //     IUSDc,
    //     user,
    //     -amount,
    //   );

    //   const cUSDCBalance = await provider.balance(user.address, cUSDC);
    //   expect(formatUSDC(cUSDCBalance)).to.be.closeTo(expectedShares, 50);
    // });

    // it('Should calculate shares correctly', async () => {
    //   const shares = await provider.calcShares(amount, cUSDC);

    //   const cUSDCBalance = await provider.balance(user.address, cUSDC);
    //   expect(formatUnits(cUSDCBalance, 8)).to.be.closeTo(formatUSDC(shares), 1);
    // });

    // it('Should calculate balance underlying correctly', async () => {
    //   const balanceUnderlying = await provider.balanceUnderlying(user.address, cUSDC);

    //   expect(formatUnits(balanceUnderlying, 8)).to.be.closeTo(amount / 1e6, 1);
    // });

    // it('Should be able to withdraw', async () => {
    //   const cUSDCBalance = await provider.balance(user.address, cUSDC);

    //   await IcUSDC.connect(user).approve(provider.address, cUSDCBalance);
    //   await provider.connect(user).withdraw(cUSDCBalance, cUSDC, usdc);

    //   // end balance should be close to starting balance of 10m minus fees
    //   expect(formatUSDC(await IUSDc.balanceOf(user.address))).to.be.closeTo(10_000_000, 250);
    // });
  });
});
