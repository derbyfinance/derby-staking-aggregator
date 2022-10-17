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
} from '@testhelp/helpers';
import type { HomoraProvider, Controller } from '@typechain';
import { deployHomoraProvider, deployController } from '@testhelp/deploy';
import {
  usdc,
  homoraUSDC as husdc,
  homoraDAI as hdai,
  homoraUSDT as husdt,
  alpha,
  dai,
  usdt,
} from '@testhelp/addresses';

// const amount = 100_000;
const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());
const amountDAI = parseDAI(amount.toString());
const amountUSDT = parseUSDC(amount.toString());

const ETFnumber = 0;

describe.skip('Testing Homora provider', async () => {
  let homoraProvider: HomoraProvider,
    controller: Controller,
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
    vaultAddr: string,
    protocolNumberUSDC: number,
    protocolNumberDAI: number,
    protocolNumberUSDT: number;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, homoraProvider, USDCSigner, DAISigner, USDTSigner, IUSDc, IDai, IUSDt] = await Promise.all([
      vault.getAddress(),
      deployHomoraProvider(dao, controller.address),
      getUSDCSigner(),
      getDAISigner(),
      getUSDTSigner(),
      erc20(usdc),
      erc20(dai),
      erc20(usdt),
    ]);

    // Transfer and approve USDC to vault AND add protocol to controller contract
    [protocolNumberUSDC, protocolNumberDAI, protocolNumberUSDT] = await Promise.all([
      controllerAddProtocol(
        controller,
        'homora_usdc_01',
        ETFnumber,
        homoraProvider.address,
        husdc,
        usdc,
        alpha,
        (1e6).toString(),
      ),
      controllerAddProtocol(
        controller,
        'homora_dai_01',
        ETFnumber,
        homoraProvider.address,
        hdai,
        dai,
        alpha,
        (1e18).toString(),
      ),
      controllerAddProtocol(
        controller,
        'homora_usdt_01',
        ETFnumber,
        homoraProvider.address,
        husdt,
        usdt,
        alpha,
        (1e6).toString(),
      ),
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IDai.connect(DAISigner).transfer(vaultAddr, amountDAI),
      IUSDt.connect(USDTSigner).transfer(vaultAddr, amountUSDT),
      IUSDc.connect(vault).approve(homoraProvider.address, amountUSDC),
      IDai.connect(vault).approve(homoraProvider.address, amountDAI),
      IUSDt.connect(vault).approve(homoraProvider.address, amountUSDT),
    ]);
  });

  it('Should deposit and withdraw USDC to Homora through controller', async function () {
    hToken = await erc20(husdc);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumberUSDC, vaultAddr, amountUSDC);
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
    await controller.connect(vault).withdraw(ETFnumber, protocolNumberUSDC, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    console.log({ vaultBalanceStart });
    console.log({ vaultBalanceEnd });

    expect(Number(formatUSDC(vaultBalanceEnd))).to.be.closeTo(Number(formatUSDC(vaultBalanceStart)), 2);
  });

  it('Should deposit and withdraw DAI to Homora through controller', async function () {
    hToken = await erc20(hdai);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IDai.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumberDAI, vaultAddr, amountDAI);
    const balanceShares = await homoraProvider.balance(vaultAddr, hdai);
    console.log({ balanceShares });

    expect(Number(balanceShares)).to.be.greaterThan(0);

    console.log(`-------------------------Withdraw-------------------------`);
    await hToken.connect(vault).approve(homoraProvider.address, balanceShares);
    await controller.connect(vault).withdraw(ETFnumber, protocolNumberDAI, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IDai.balanceOf(vaultAddr);
    console.log({ vaultBalanceEnd });

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(Number(formatDAI(vaultBalanceStart)), 2);
  });

  it('Should deposit and withdraw USDT to Homora through controller', async function () {
    hToken = await erc20(husdt);
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDt.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumberUSDT, vaultAddr, amountUSDT);
    const balanceShares = await homoraProvider.balance(vaultAddr, husdt);
    console.log({ balanceShares });

    expect(Number(balanceShares)).to.be.greaterThan(0);

    console.log(`-------------------------Withdraw-------------------------`);
    await hToken.connect(vault).approve(homoraProvider.address, balanceShares);
    await controller.connect(vault).withdraw(ETFnumber, protocolNumberUSDT, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IUSDt.balanceOf(vaultAddr);
    console.log({ vaultBalanceEnd });

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(Number(formatDAI(vaultBalanceStart)), 2);
  });

  it('Should fail when !controller is calling the Provider', async function () {
    await expect(homoraProvider.connect(vault).deposit(vaultAddr, amountUSDC, husdc, usdc)).to.be.revertedWith(
      'ETFProvider: only controller',
    );
  });

  it('Should fail when !Vault is calling the controller', async function () {
    await expect(controller.deposit(ETFnumber, protocolNumberUSDC, vaultAddr, amountUSDC)).to.be.revertedWith(
      'Controller: only Vault',
    );
  });

  // it("Should get exchangeRate through controller", async function() {
  //   const exchangeRate = await controller.connect(vault).exchangeRate(ETFnumber, protocolNumberUSDC)
  //   console.log(`Exchange rate ${exchangeRate}`)
  // });
});
