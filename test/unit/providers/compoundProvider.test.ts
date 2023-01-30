import { expect } from 'chai';
import { deployments } from 'hardhat';
import { getUSDCSigner, erc20, getWhale, transferAndApproveUSDC } from '@testhelp/helpers';
import type { CompoundProviderMock, CompoundVaultMock } from '@typechain';
import {
  usdc,
  compoundUSDC as cusdc,
  comptroller,
  compToken as compTokenAddr,
} from '@testhelp/addresses';
import { getAllSigners, getContract } from '@testhelp/getContracts';
import { Contract, Signer } from 'ethers';

const cusdcWhaleAddr = '0xabde2f02fe84e083e1920471b54c3612456365ef';

describe('Testing Compound provider', async () => {
  const IUSDc: Contract = erc20(usdc);
  let provider: CompoundProviderMock, compoundVaultMock: CompoundVaultMock, user: Signer;

  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['CompoundVaultMockUSDC', 'CompoundProvider']);
    const provider = (await getContract('CompoundProvider', hre)) as CompoundProviderMock;
    const compoundVaultMock = (await getContract('CompoundVaultMock', hre)) as CompoundVaultMock;

    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);

    return { provider, yearnVaultMock: compoundVaultMock, user };
  });

  before(async () => {
    const setup = await setupProvider();
    provider = setup.provider;
    compoundVaultMock = setup.yearnVaultMock;
    user = setup.user;
  });

  // it('Should deposit and withdraw to Compound', async function () {
  //   console.log(`-------------------------Deposit-------------------------`);
  //   const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

  //   await compoundProviderMock.connect(vault).deposit(amountUSDC, cusdc, usdc);
  //   const balanceShares = Number(await compoundProviderMock.balance(vaultAddr, cusdc));
  //   const price = Number(await compoundProviderMock.exchangeRate(cusdc));
  //   const amount = (balanceShares * price) / 1e18;

  //   expect(amount).to.be.closeTo(Number(amountUSDC), 2);

  //   const vaultBalance = await IUSDc.balanceOf(vaultAddr);

  //   expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(Number(amountUSDC));

  //   console.log(`-------------------------Withdraw-------------------------`);
  //   console.log(`balance shares ${balanceShares}`);

  //   await cToken.connect(vault).approve(compoundProviderMock.address, balanceShares);
  //   await compoundProviderMock.connect(vault).withdraw(balanceShares, cusdc, usdc);

  //   const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);

  //   expect(Number(vaultBalanceEnd) - Number(vaultBalance)).to.be.closeTo(Number(amountUSDC), 800); // not formatted
  // });

  // it('Should claim Comp tokens from Comptroller', async function () {
  //   await compoundProviderMock.connect(vault).claim(cusdc, vaultAddr);

  //   const compBalanceBefore = Number(await compToken.balanceOf(cusdcWhaleAddr));
  //   await compoundProviderMock.connect(cusdcWhale).claimTest(cusdcWhaleAddr, cusdc);
  //   const compBalanceAfter = Number(await compToken.balanceOf(cusdcWhaleAddr));

  //   console.log(`Balance Before ${compBalanceBefore}`);
  //   console.log(`Balance After ${compBalanceAfter}`);

  //   expect(compBalanceAfter).to.be.greaterThan(compBalanceBefore);
  // });

  // it('Should get Compound exchangeRate', async function () {
  //   const exchangeRate = await compoundProviderMock.connect(vault).exchangeRate(cusdc);
  //   console.log(`Exchange rate ${exchangeRate}`);
  // });

  describe('Testing CompoundVaultMock', () => {
    it('Should have exchangeRate', async function () {
      await compoundVaultMock.setExchangeRate(1.2 * 1e8);
      expect(await compoundVaultMock.exchangeRate()).to.be.equal(1.2 * 1e8);
    });

    it('Should deposit in VaultMock', async () => {
      // set exchangeRate to 2
      await compoundVaultMock.setExchangeRate(2 * 1e8);

      await expect(() =>
        provider.connect(user).deposit(100_000 * 1e6, compoundVaultMock.address, usdc),
      ).to.changeTokenBalance(compoundVaultMock, user, (100_000 * 1e6) / 2);
    });

    it('Should withdraw from VaultMock', async () => {
      // set exchangeRate to 2.5
      await compoundVaultMock.setExchangeRate(2.5 * 1e8);

      await compoundVaultMock.connect(user).approve(provider.address, 20_000 * 1e6);
      await expect(() =>
        provider.connect(user).withdraw(20_000 * 1e6, compoundVaultMock.address, usdc),
      ).to.changeTokenBalance(IUSDc, user, 20_000 * 1e6 * 2.5);
    });
  });
});
