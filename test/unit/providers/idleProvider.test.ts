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
  formatEther,
} from '@testhelp/helpers';
import type { IdleProvider, Controller } from '@typechain';
import { deployIdleProvider, deployController } from '@testhelp/deploy';
import {
  usdc,
  idleUSDC as iusdc,
  idleDAI as idai,
  idleUSDT as iusdt,
  yearn,
  dai,
  usdt,
} from '@testhelp/addresses';

// const amount = 100_000;
const amount = Math.floor(Math.random() * 1000000);
const amountUSDC = parseUSDC(amount.toString());
const amountDAI = parseDAI(amount.toString());
const amountUSDT = parseUSDC(amount.toString());
const uScale = ethers.BigNumber.from((1e6).toString());
const protocolUScale = ethers.BigNumber.from((1e18).toString());

const ETFnumber = 0;

describe.skip('Testing Idle provider', async () => {
  let idleProvider: IdleProvider,
    controller: Controller,
    dao: Signer,
    vault: Signer,
    USDCSigner: Signer,
    DAISigner: Signer,
    USDTSigner: Signer,
    IUSDc: Contract,
    IDai: Contract,
    IUSDt: Contract,
    iToken: Contract,
    daoAddr: string,
    vaultAddr: string,
    protocolNumberUSDC: number;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, idleProvider, USDCSigner, DAISigner, USDTSigner, IUSDc, IDai, IUSDt] =
      await Promise.all([
        vault.getAddress(),
        deployIdleProvider(dao),
        getUSDCSigner(),
        getDAISigner(),
        getUSDTSigner(),
        erc20(usdc),
        erc20(dai),
        erc20(usdt),
      ]);

    // Transfer and approve USDC to vault AND add protocol to controller contract
    await Promise.all([
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IDai.connect(DAISigner).transfer(vaultAddr, amountDAI),
      IUSDt.connect(USDTSigner).transfer(vaultAddr, amountUSDT),
      IUSDc.connect(vault).approve(idleProvider.address, amountUSDC),
      IDai.connect(vault).approve(idleProvider.address, amountDAI),
      IUSDt.connect(vault).approve(idleProvider.address, amountUSDT),
    ]);
  });

  it('Should deposit and withdraw USDC to idle through controller', async function () {
    iToken = await erc20(iusdc);
    console.log(`-------------------------Deposit-------------------  ------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await idleProvider.connect(vault).deposit(amountUSDC, iusdc, usdc);
    const balanceShares = await idleProvider.balance(vaultAddr, iusdc);
    const balanceUnderlying = await idleProvider.balanceUnderlying(vaultAddr, iusdc);
    const calcShares = await idleProvider.calcShares(balanceUnderlying, iusdc);
    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    console.log({ balanceShares });
    console.log({ balanceUnderlying });
    console.log(Number(formatEther(calcShares)));

    expect(Number(formatEther(calcShares))).to.be.closeTo(Number(formatEther(balanceShares)), 6);
    expect(balanceUnderlying.mul(uScale).div(protocolUScale)).to.be.closeTo(amountUSDC, 5);
    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    console.log(`-------------------------Withdraw-------------------------`);
    await iToken.connect(vault).approve(idleProvider.address, balanceShares);
    await idleProvider.connect(vault).withdraw(balanceShares, iusdc, usdc);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);

    expect(Number(formatUSDC(vaultBalanceEnd))).to.be.closeTo(
      Number(formatUSDC(vaultBalanceStart)),
      2,
    );
  });

  it('Should deposit and withdraw DAI to idle through controller', async function () {
    iToken = await erc20(idai);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IDai.balanceOf(vaultAddr);

    await idleProvider.connect(vault).deposit(amountDAI, idai, dai);
    const balanceShares = await idleProvider.balance(vaultAddr, idai);
    const balanceUnderlying = await idleProvider.balanceUnderlying(vaultAddr, idai);
    const calcShares = await idleProvider.calcShares(balanceUnderlying, idai);
    const vaultBalance = await IDai.balanceOf(vaultAddr);

    expect(Number(formatEther(calcShares))).to.be.closeTo(Number(formatEther(balanceShares)), 5);
    expect(balanceUnderlying).to.be.closeTo(amountDAI, 5);
    expect(vaultBalanceStart.sub(vaultBalance)).to.equal(amountDAI);

    console.log(`-------------------------Withdraw-------------------------`);
    await iToken.connect(vault).approve(idleProvider.address, balanceShares);
    await idleProvider.connect(vault).withdraw(balanceShares, idai, dai);

    const vaultBalanceEnd = await IDai.balanceOf(vaultAddr);

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(
      Number(formatDAI(vaultBalanceStart)),
      2,
    );
  });

  it('Should deposit and withdraw USDT to idle through controller', async function () {
    iToken = await erc20(iusdt);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDt.balanceOf(vaultAddr);

    await idleProvider.connect(vault).deposit(amountUSDT, iusdt, usdt);
    const balanceShares = await idleProvider.balance(vaultAddr, iusdt);
    const balanceUnderlying = await idleProvider.balanceUnderlying(vaultAddr, iusdt);
    const calcShares = await idleProvider.calcShares(balanceUnderlying, iusdt);
    const vaultBalance = await IUSDt.balanceOf(vaultAddr);

    expect(Number(formatEther(calcShares))).to.be.closeTo(Number(formatEther(balanceShares)), 5);
    expect(balanceUnderlying.mul(uScale).div(protocolUScale)).to.be.closeTo(amountUSDT, 5);
    expect(vaultBalanceStart.sub(vaultBalance)).to.equal(amountUSDT);

    console.log(`-------------------------Withdraw-------------------------`);
    await iToken.connect(vault).approve(idleProvider.address, balanceShares);
    await idleProvider.connect(vault).withdraw(balanceShares, iusdt, usdt);

    const vaultBalanceEnd = await IUSDt.balanceOf(vaultAddr);

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(
      Number(formatDAI(vaultBalanceStart)),
      2,
    );
  });

  it('Should get exchangeRate through controller', async function () {
    const exchangeRate = await controller
      .connect(vault)
      .exchangeRate(ETFnumber, protocolNumberUSDC);
    console.log(`Exchange rate ${exchangeRate}`);
  });
});
