import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { getUSDCSigner, erc20, formatUSDC, parseUSDC } from '@testhelp/helpers';
import type { YearnProvider, Controller } from '@typechain';
import { deployYearnProvider, deployController } from '@testhelp/deploy';
import { usdc, yearnUSDC as yusdc, yearn } from '@testhelp/addresses';

const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());
const ETFnumber = 0;

describe.skip('Testing Yearn provider', async () => {
  let yearnProvider: YearnProvider,
    controller: Controller,
    dao: Signer,
    vault: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    yToken: Contract,
    daoAddr: string,
    vaultAddr: string;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, yearnProvider, USDCSigner, IUSDc, yToken] = await Promise.all([
      vault.getAddress(),
      deployYearnProvider(dao),
      getUSDCSigner(),
      erc20(usdc),
      erc20(yusdc),
    ]);

    // Transfer and approve USDC to vault AND add protocol to controller contract
    await Promise.all([
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(yearnProvider.address, amountUSDC),
    ]);
  });

  it('Should deposit and withdraw to Yearn through controller', async function () {
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await yearnProvider.connect(vault).deposit(amountUSDC, yusdc, usdc);
    const balanceShares = Number(await yearnProvider.balance(vaultAddr, yusdc));
    const price = Number(await yearnProvider.exchangeRate(yusdc));
    const amount = (balanceShares * price) / 1e12;

    expect(amount).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    console.log(`-------------------------Withdraw-------------------------`);
    await yToken.connect(vault).approve(yearnProvider.address, balanceShares);
    await yearnProvider.connect(vault).withdraw(balanceShares, yusdc, usdc);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10);
  });

  it('Should get exchangeRate', async function () {
    const exchangeRate = await yearnProvider.connect(vault).exchangeRate(yusdc);
    console.log(`Exchange rate ${exchangeRate}`);
  });
});
