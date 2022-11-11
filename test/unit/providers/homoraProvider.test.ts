import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
  getUSDCSigner,
  erc20,
  formatUSDC,
  parseUSDC,
  getDAISigner,
  getUSDTSigner,
  parseDAI,
  formatDAI,
} from '@testhelp/helpers';
import type { HomoraProvider, Controller } from '@typechain';
import { deployHomoraProvider, deployController } from '@testhelp/deploy';
import {
  usdc,
  homoraUSDC as husdc,
  homoraDAI as hdai,
  homoraUSDT as husdt,
  dai,
  usdt,
} from '@testhelp/addresses';

// const amount = 100_000;
const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());
const amountDAI = parseDAI(amount.toString());
const amountUSDT = parseUSDC(amount.toString());

describe('Testing Homora provider', async () => {
  let homoraProvider: HomoraProvider,
    dao: Signer,
    vault: Signer,
    USDCSigner: Signer,
    DAISigner: Signer,
    USDTSigner: Signer,
    IUSDc: Contract,
    IDai: Contract,
    IUSDt: Contract,
    hToken: Contract,
    daoAddr: string,
    vaultAddr: string;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();

    [vaultAddr, homoraProvider, USDCSigner, DAISigner, USDTSigner, IUSDc, IDai, IUSDt] =
      await Promise.all([
        vault.getAddress(),
        deployHomoraProvider(dao),
        getUSDCSigner(),
        getDAISigner(),
        getUSDTSigner(),
        erc20(usdc),
        erc20(dai),
        erc20(usdt),
      ]);

    // Transfer and approve USDC to vault AND add protocol to controller contract
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IDai.connect(DAISigner).transfer(vaultAddr, amountDAI),
      IUSDt.connect(USDTSigner).transfer(vaultAddr, amountUSDT),
      IUSDc.connect(vault).approve(homoraProvider.address, amountUSDC),
      IDai.connect(vault).approve(homoraProvider.address, amountDAI),
      IUSDt.connect(vault).approve(homoraProvider.address, amountUSDT),
    ]);
  });

  it('Should deposit and withdraw USDC to Homora', async function () {
    hToken = erc20(husdc);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await homoraProvider.connect(vault).deposit(amountUSDC, husdc, usdc);
    const balanceShares = await homoraProvider.balance(vaultAddr, husdc);
    // const balanceUnderlying = await homoraProvider.balanceUnderlying(vaultAddr, husdc);
    // const calcShares = await homoraProvider.calcShares(balanceUnderlying, husdc);

    // const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    console.log({ balanceShares });
    expect(Number(balanceShares)).to.be.greaterThan(0);

    // expect(calcShares).to.be.closeTo(balanceShares, 2);
    // expect(balanceUnderlying).to.be.closeTo(amountUSDC, 2);
    // expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    console.log(`-------------------------Withdraw-------------------------`);
    await hToken.connect(vault).approve(homoraProvider.address, balanceShares);
    await homoraProvider.connect(vault).withdraw(balanceShares, husdc, usdc);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    console.log({ vaultBalanceStart });
    console.log({ vaultBalanceEnd });

    expect(Number(formatUSDC(vaultBalanceEnd))).to.be.closeTo(
      Number(formatUSDC(vaultBalanceStart)),
      2,
    );
  });

  it('Should deposit and withdraw DAI to Homora', async function () {
    hToken = erc20(hdai);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IDai.balanceOf(vaultAddr);

    await homoraProvider.connect(vault).deposit(amountDAI, hdai, dai);
    const balanceShares = await homoraProvider.balance(vaultAddr, hdai);
    console.log({ balanceShares });

    expect(Number(balanceShares)).to.be.greaterThan(0);

    console.log(`-------------------------Withdraw-------------------------`);
    await hToken.connect(vault).approve(homoraProvider.address, balanceShares);
    await homoraProvider.connect(vault).withdraw(balanceShares, hdai, dai);

    const vaultBalanceEnd = await IDai.balanceOf(vaultAddr);
    console.log({ vaultBalanceEnd });

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(
      Number(formatDAI(vaultBalanceStart)),
      2,
    );
  });

  it('Should deposit and withdraw USDT to Homora', async function () {
    hToken = erc20(husdt);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDt.balanceOf(vaultAddr);

    await homoraProvider.connect(vault).deposit(amountUSDT, husdt, usdt);
    const balanceShares = await homoraProvider.balance(vaultAddr, husdt);
    console.log({ balanceShares });

    expect(Number(balanceShares)).to.be.greaterThan(0);

    console.log(`-------------------------Withdraw-------------------------`);
    await hToken.connect(vault).approve(homoraProvider.address, balanceShares);
    await homoraProvider.connect(vault).withdraw(balanceShares, husdt, usdt);

    const vaultBalanceEnd = await IUSDt.balanceOf(vaultAddr);
    console.log({ vaultBalanceEnd });

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(
      Number(formatDAI(vaultBalanceStart)),
      2,
    );
  });
});
