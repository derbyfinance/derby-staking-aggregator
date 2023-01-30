import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { deployments } from 'hardhat';
import { erc20, transferAndApproveUSDC } from '@testhelp/helpers';
import type { YearnProvider, YearnVaultMock } from '@typechain';
import { usdc, yearn } from '@testhelp/addresses';
import { getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Yearn provider', async () => {
  const IUSDc: Contract = erc20(usdc);
  let provider: YearnProvider, yearnVaultMock: YearnVaultMock, user: Signer;

  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['YearnVaultMock', 'YearnProvider']);
    const provider = (await getContract('YearnProvider', hre)) as YearnProvider;
    const yearnVaultMock = (await getContract('YearnVaultMock', hre)) as YearnVaultMock;

    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);

    return { provider, yearnVaultMock, user };
  });

  before(async () => {
    const setup = await setupProvider();
    provider = setup.provider;
    yearnVaultMock = setup.yearnVaultMock;
    user = setup.user;
  });

  // it.skip('Should deposit and withdraw to Yearn through controller', async function () {
  //   console.log(`-------------------------Deposit-------------------------`);
  //   const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

  //   await yearnProvider.connect(vault).deposit(amountUSDC, yusdc, usdc);
  //   const balanceShares = Number(await yearnProvider.balance(vaultAddr, yusdc));
  //   const price = Number(await yearnProvider.exchangeRate(yusdc));
  //   const amount = (balanceShares * price) / 1e12;

  //   expect(amount).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);

  //   const vaultBalance = await IUSDc.balanceOf(vaultAddr);

  //   expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

  //   console.log(`-------------------------Withdraw-------------------------`);
  //   await yToken.connect(vault).approve(yearnProvider.address, balanceShares);
  //   await yearnProvider.connect(vault).withdraw(balanceShares, yusdc, usdc);

  //   const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
  //   expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10);
  // });

  // it.skip('Should get exchangeRate', async function () {
  //   const exchangeRate = await yearnProvider.connect(vault).exchangeRate(yusdc);
  //   console.log(`Exchange rate ${exchangeRate}`);
  // });

  describe('Testing YearnMockVault', () => {
    it('Should have exchangeRate', async function () {
      await yearnVaultMock.setExchangeRate(1.2 * 1e6);
      expect(await yearnVaultMock.exchangeRate()).to.be.equal(1.2 * 1e6);
    });

    it('Should deposit in VaultMock', async () => {
      // set exchangeRate to 2
      await yearnVaultMock.setExchangeRate(2 * 1e6);

      await expect(() =>
        provider.connect(user).deposit(100_000 * 1e6, yearnVaultMock.address, usdc),
      ).to.changeTokenBalance(yearnVaultMock, user, (100_000 * 1e6) / 2);
    });

    it('Should withdraw from VaultMock', async () => {
      // set exchangeRate to 2.5
      await yearnVaultMock.setExchangeRate(2.5 * 1e6);

      await yearnVaultMock.connect(user).approve(provider.address, 20_000 * 1e6);
      await expect(() =>
        provider.connect(user).withdraw(20_000 * 1e6, yearnVaultMock.address, usdc),
      ).to.changeTokenBalance(IUSDc, user, 20_000 * 1e6 * 2.5);
    });
  });
});
