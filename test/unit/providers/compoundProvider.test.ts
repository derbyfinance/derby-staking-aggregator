import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { getUSDCSigner, erc20, parseUSDC, getWhale } from '@testhelp/helpers';
import type { CompoundProviderMock } from '@typechain';
import { deployCompoundProviderMock } from '@testhelp/deploy';
import {
  usdc,
  compoundUSDC as cusdc,
  comptroller,
  compToken as compTokenAddr,
} from '@testhelp/addresses';

const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());
const cusdcWhaleAddr = '0xabde2f02fe84e083e1920471b54c3612456365ef';

describe.skip('Testing Compound provider', async () => {
  let compoundProviderMock: CompoundProviderMock,
    dao: Signer,
    vault: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    cToken: Contract,
    daoAddr: string,
    vaultAddr: string,
    cusdcWhale: Signer,
    compToken: Contract;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();

    [vaultAddr, compoundProviderMock, USDCSigner, cusdcWhale, IUSDc, cToken, compToken] =
      await Promise.all([
        vault.getAddress(),
        deployCompoundProviderMock(dao, comptroller),
        getUSDCSigner(),
        getWhale(cusdcWhaleAddr),
        erc20(usdc),
        erc20(cusdc),
        erc20(compTokenAddr),
      ]);

    // Transfer and approve USDC to vault AND add protocol to controller contract
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(compoundProviderMock.address, amountUSDC),
    ]);
  });

  it('Should deposit and withdraw to Compound', async function () {
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await compoundProviderMock.connect(vault).deposit(amountUSDC, cusdc, usdc);
    const balanceShares = Number(await compoundProviderMock.balance(vaultAddr, cusdc));
    const price = Number(await compoundProviderMock.exchangeRate(cusdc));
    const amount = (balanceShares * price) / 1e18;

    expect(amount).to.be.closeTo(Number(amountUSDC), 2);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(Number(amountUSDC));

    console.log(`-------------------------Withdraw-------------------------`);
    console.log(`balance shares ${balanceShares}`);

    await cToken.connect(vault).approve(compoundProviderMock.address, balanceShares);
    await compoundProviderMock.connect(vault).withdraw(balanceShares, cusdc, usdc);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);

    expect(Number(vaultBalanceEnd) - Number(vaultBalance)).to.be.closeTo(Number(amountUSDC), 800); // not formatted
  });

  it('Should claim Comp tokens from Comptroller', async function () {
    await compoundProviderMock.connect(vault).claim(cusdc, vaultAddr);

    const compBalanceBefore = Number(await compToken.balanceOf(cusdcWhaleAddr));
    await compoundProviderMock.connect(cusdcWhale).claimTest(cusdcWhaleAddr, cusdc);
    const compBalanceAfter = Number(await compToken.balanceOf(cusdcWhaleAddr));

    console.log(`Balance Before ${compBalanceBefore}`);
    console.log(`Balance After ${compBalanceAfter}`);

    expect(compBalanceAfter).to.be.greaterThan(compBalanceBefore);
  });

  it('Should get Compound exchangeRate', async function () {
    const exchangeRate = await compoundProviderMock.connect(vault).exchangeRate(cusdc);
    console.log(`Exchange rate ${exchangeRate}`);
  });
});
