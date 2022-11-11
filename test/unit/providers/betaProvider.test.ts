import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
  getUSDCSigner,
  erc20,
  formatUSDC,
  parseUSDC,
  controllerAddProtocol,
  getDAISigner,
  getUSDTSigner,
  parseDAI,
  formatDAI,
  formatEther,
} from '@testhelp/helpers';
import type { BetaProvider } from '@typechain';
import { deployBetaProvider } from '@testhelp/deploy';
import {
  usdc,
  betaUSDC as busdc,
  betaDAI as bdai,
  betaUSDT as iusdt,
  dai,
  usdt,
  betaUSDC,
  betaDAI,
  betaUSDT,
} from '@testhelp/addresses';

// const amount = 100_000;
const amount = Math.floor(Math.random() * 1000000);
const amountUSDC = parseUSDC(amount.toString());
const amountDAI = parseDAI(amount.toString());
const amountUSDT = parseUSDC(amount.toString());

describe.skip('Testing Beta provider', async () => {
  let betaProvider: BetaProvider,
    dao: Signer,
    vault: Signer,
    USDCSigner: Signer,
    DAISigner: Signer,
    USDTSigner: Signer,
    IUSDc: Contract,
    IDai: Contract,
    IUSDt: Contract,
    bToken: Contract,
    daoAddr: string,
    vaultAddr: string;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();

    [vaultAddr, betaProvider, USDCSigner, DAISigner, USDTSigner, IUSDc, IDai, IUSDt] =
      await Promise.all([
        vault.getAddress(),
        deployBetaProvider(dao),
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
      IUSDc.connect(vault).approve(betaProvider.address, amountUSDC),
      IDai.connect(vault).approve(betaProvider.address, amountDAI),
      IUSDt.connect(vault).approve(betaProvider.address, amountUSDT),
    ]);
  });

  it('Should deposit and withdraw USDC to beta', async function () {
    bToken = erc20(busdc);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await betaProvider.connect(vault).deposit(amountUSDC, busdc, usdc);
    const balanceShares = await betaProvider.balance(vaultAddr, busdc);
    const balanceUnderlying = await betaProvider.balanceUnderlying(vaultAddr, busdc);
    const calcShares = await betaProvider.calcShares(balanceUnderlying, busdc);
    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(Number(formatEther(calcShares))).to.be.closeTo(Number(formatEther(balanceShares)), 5);
    expect(balanceUnderlying).to.be.closeTo(amountUSDC, 5);
    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    console.log(`-------------------------Withdraw-------------------------`);
    await bToken.connect(vault).approve(betaProvider.address, balanceShares);
    await betaProvider.connect(vault).withdraw(balanceShares, busdc, usdc);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);

    console.log({ vaultBalanceEnd });
    expect(Number(formatUSDC(vaultBalanceEnd))).to.be.closeTo(
      Number(formatUSDC(vaultBalanceStart)),
      2,
    );
  });

  it('Should deposit and withdraw DAI to beta', async function () {
    bToken = erc20(bdai);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IDai.balanceOf(vaultAddr);

    await betaProvider.connect(vault).deposit(amountDAI, bdai, dai);
    const balanceShares = await betaProvider.balance(vaultAddr, bdai);
    const balanceUnderlying = await betaProvider.balanceUnderlying(vaultAddr, bdai);
    const calcShares = await betaProvider.calcShares(balanceUnderlying, bdai);
    const vaultBalance = await IDai.balanceOf(vaultAddr);

    expect(Number(formatEther(calcShares))).to.be.closeTo(Number(formatEther(balanceShares)), 5);
    expect(balanceUnderlying).to.be.closeTo(amountDAI, 5);
    expect(vaultBalanceStart.sub(vaultBalance)).to.equal(amountDAI);

    console.log(`-------------------------Withdraw-------------------------`);
    await bToken.connect(vault).approve(betaProvider.address, balanceShares);
    await betaProvider.connect(vault).withdraw(balanceShares, bdai, dai);

    const vaultBalanceEnd = await IDai.balanceOf(vaultAddr);

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(
      Number(formatDAI(vaultBalanceStart)),
      2,
    );
  });

  it('Should deposit and withdraw USDT to beta', async function () {
    bToken = erc20(iusdt);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDt.balanceOf(vaultAddr);

    await betaProvider.connect(vault).deposit(amountUSDT, betaUSDT, usdt);
    const balanceShares = await betaProvider.balance(vaultAddr, iusdt);
    const balanceUnderlying = await betaProvider.balanceUnderlying(vaultAddr, iusdt);
    const calcShares = await betaProvider.calcShares(balanceUnderlying, iusdt);
    const vaultBalance = await IUSDt.balanceOf(vaultAddr);

    expect(Number(formatEther(calcShares))).to.be.closeTo(Number(formatEther(balanceShares)), 5);
    expect(balanceUnderlying).to.be.closeTo(amountUSDT, 5);
    expect(vaultBalanceStart.sub(vaultBalance)).to.equal(amountUSDT);

    console.log(`-------------------------Withdraw-------------------------`);
    await bToken.connect(vault).approve(betaProvider.address, balanceShares);
    await betaProvider.connect(vault).withdraw(balanceShares, betaUSDT, usdt);

    const vaultBalanceEnd = await IUSDt.balanceOf(vaultAddr);

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(
      Number(formatDAI(vaultBalanceStart)),
      2,
    );
  });

  it('Should get exchangeRate', async function () {
    const exchangeRate = await betaProvider.connect(vault).exchangeRate(betaUSDC);
    console.log(`Exchange rate ${exchangeRate}`);
  });
});
