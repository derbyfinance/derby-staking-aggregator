import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { deployments } from 'hardhat';
import { erc20, getDAISigner, parseEther, transferAndApproveUSDC } from '@testhelp/helpers';
import type { YearnProvider, YearnVaultMock } from '@typechain';
import { dai, usdc, yearn } from '@testhelp/addresses';
import { deployYearnMockVaults, getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Yearn provider for Mock vaults', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture([
      'YearnMockUSDC1',
      'YearnMockUSDC2',
      'YearnMockDAI1',
      'YearnMockDAI2',
      'YearnMockUSDT1',
      'YearnProvider',
    ]);
    const provider = (await getContract('YearnProvider', hre)) as YearnProvider;
    const [yearnUSDC, , yearnDAI, , yearnUSDT] = await deployYearnMockVaults(hre);

    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);

    // approve and send DAI to user
    const daiAmount = parseEther(1_000_000);
    const daiSigner = await getDAISigner();
    const IDAI = erc20(dai);
    await IDAI.connect(daiSigner).transfer(user.getAddress(), daiAmount);
    await IDAI.connect(user).approve(provider.address, daiAmount);

    return { provider, yearnUSDC, yearnDAI, yearnUSDT, user };
  });

  describe('Testing YearnMockVault USDC', () => {
    const IUSDc: Contract = erc20(usdc);
    let provider: YearnProvider, yearnUSDC: YearnVaultMock, user: Signer;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      yearnUSDC = setup.yearnUSDC;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      await yearnUSDC.setExchangeRate(1.2 * 1e6);
      expect(await yearnUSDC.exchangeRate()).to.be.equal(1.2 * 1e6);
    });

    it('Should deposit in VaultMock', async () => {
      // set exchangeRate to 2
      await yearnUSDC.setExchangeRate(2 * 1e6);

      await expect(() =>
        provider.connect(user).deposit(100_000 * 1e6, yearnUSDC.address, usdc),
      ).to.changeTokenBalance(yearnUSDC, user, (100_000 * 1e6) / 2);
    });

    it('Should withdraw from VaultMock', async () => {
      // set exchangeRate to 2.5
      await yearnUSDC.setExchangeRate(2.5 * 1e6);

      await yearnUSDC.connect(user).approve(provider.address, 20_000 * 1e6);
      await expect(() =>
        provider.connect(user).withdraw(20_000 * 1e6, yearnUSDC.address, usdc),
      ).to.changeTokenBalance(IUSDc, user, 20_000 * 1e6 * 2.5);
    });
  });

  describe('Testing YearnMockVault DAI', () => {
    const IDAI: Contract = erc20(dai);
    let provider: YearnProvider, yearnDAI: YearnVaultMock, user: Signer;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      yearnDAI = setup.yearnDAI;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      await yearnDAI.setExchangeRate(parseEther(1.2));
      expect(await yearnDAI.exchangeRate()).to.be.equal(parseEther(1.2));
    });

    it('Should deposit in VaultMock', async () => {
      // set exchangeRate to 1.5
      await yearnDAI.setExchangeRate(parseEther(2));

      await expect(() =>
        provider.connect(user).deposit(parseEther(100_000), yearnDAI.address, dai),
      ).to.changeTokenBalance(yearnDAI, user, parseEther(100_000 / 2));
    });

    it('Should calc balance correctly', async function () {
      expect(await provider.connect(user).balance(user.address, yearnDAI.address)).to.be.equal(
        parseEther(100_000 / 2),
      );
    });

    it('Should calc shares correctly', async function () {
      expect(
        await provider.connect(user).calcShares(parseEther(100_000), yearnDAI.address),
      ).to.be.equal(parseEther(100_000 / 2));
    });

    it('Should calc balanceUnderlying correctly', async function () {
      expect(
        await provider.connect(user).balanceUnderlying(user.address, yearnDAI.address),
      ).to.be.equal(parseEther(100_000));
    });

    it('Should withdraw from VaultMock', async () => {
      // set exchangeRate to 2.5
      await yearnDAI.setExchangeRate(parseEther(2.5));

      await yearnDAI.connect(user).approve(provider.address, parseEther(20_000));
      await expect(() =>
        provider.connect(user).withdraw(parseEther(20_000), yearnDAI.address, dai),
      ).to.changeTokenBalance(IDAI, user, parseEther(20_000 * 2.5));
    });
  });
});
