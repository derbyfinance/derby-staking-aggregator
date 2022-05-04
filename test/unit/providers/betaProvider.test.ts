/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, controllerAddProtocol, getDAISigner, getUSDTSigner, parseDAI, formatDAI, formatEther, } from '../../helpers/helpers';
import type { BetaProvider, Controller } from '../../../typechain-types';
import { deployBetaProvider, deployController } from '../../helpers/deploy';
import { usdc, betaUSDC as busdc, betaDAI as bdai, betaUSDT as iusdt, yearn, dai, usdt} from "../../helpers/addresses";

const amount = 100_000;
// const amount = Math.floor(Math.random() * 1000000);
const amountUSDC = parseUSDC(amount.toString());
const amountDAI = parseDAI(amount.toString());
const amountUSDT = parseUSDC(amount.toString());

const ETFnumber = 0;

describe("Testing Beta provider", async () => {
  let betaProvider: BetaProvider, controller: Controller, dao: Signer, vault: Signer, USDCSigner: Signer, DAISigner: Signer, USDTSigner: Signer, IUSDc: Contract, IDai: Contract, IUSDt: Contract, bToken: Contract, daoAddr: string, vaultAddr: string, protocolNumberUSDC: number, protocolNumberDAI: number, protocolNumberUSDT: number;

  beforeEach(async function() {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, betaProvider, USDCSigner, DAISigner, USDTSigner, IUSDc, IDai, IUSDt] = await Promise.all([
      vault.getAddress(),
      deployBetaProvider(dao, controller.address),
      getUSDCSigner(),
      getDAISigner(),
      getUSDTSigner(),
      erc20(usdc),
      erc20(dai),
      erc20(usdt),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to controller contract
    [protocolNumberUSDC, protocolNumberDAI, protocolNumberUSDT] = await Promise.all([
      controllerAddProtocol(controller, 'beta_usdc_01', ETFnumber, betaProvider.address, busdc, usdc, yearn, 1E6.toString()),
      controllerAddProtocol(controller, 'beta_dai_01', ETFnumber, betaProvider.address, bdai, dai, yearn, 1E18.toString()),
      controllerAddProtocol(controller, 'beta_usdt_01', ETFnumber, betaProvider.address, iusdt, usdt, yearn, 1E6.toString()),
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IDai.connect(DAISigner).transfer(vaultAddr, amountDAI),
      IUSDt.connect(USDTSigner).transfer(vaultAddr, amountUSDT),
      IUSDc.connect(vault).approve(betaProvider.address, amountUSDC),
      IDai.connect(vault).approve(betaProvider.address, amountDAI),
      IUSDt.connect(vault).approve(betaProvider.address, amountUSDT),
    ])
  });

  it("Should deposit and withdraw USDC to beta through controller", async function() {
    bToken = await erc20(busdc);
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumberUSDC, vaultAddr, amountUSDC);
    const balanceShares = await betaProvider.balance(vaultAddr, busdc);
    const balanceUnderlying = await betaProvider.balanceUnderlying(vaultAddr, busdc);
    const calcShares = await betaProvider.calcShares(balanceUnderlying, busdc);
    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(Number(formatEther(calcShares))).to.be.closeTo(Number(formatEther(balanceShares)), 5);
    expect(balanceUnderlying).to.be.closeTo(amountUSDC, 5);
    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    console.log(`-------------------------Withdraw-------------------------`); 
    await bToken.connect(vault).approve(betaProvider.address, balanceShares);
    await controller.connect(vault).withdraw(ETFnumber, protocolNumberUSDC, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);

    console.log({vaultBalanceEnd});
    expect(Number(formatUSDC(vaultBalanceEnd))).to.be.closeTo(Number(formatUSDC(vaultBalanceStart)), 2)
  });

  it("Should deposit and withdraw DAI to beta through controller", async function() {
    bToken = await erc20(bdai);
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IDai.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumberDAI, vaultAddr, amountDAI);
    const balanceShares = await betaProvider.balance(vaultAddr, bdai);
    const balanceUnderlying = await betaProvider.balanceUnderlying(vaultAddr, bdai);
    const calcShares = await betaProvider.calcShares(balanceUnderlying, bdai);
    const vaultBalance = await IDai.balanceOf(vaultAddr);

    expect(Number(formatEther(calcShares))).to.be.closeTo(Number(formatEther(balanceShares)), 5);
    expect(balanceUnderlying).to.be.closeTo(amountDAI, 5);
    expect(vaultBalanceStart.sub(vaultBalance)).to.equal(amountDAI);

    console.log(`-------------------------Withdraw-------------------------`); 
    await bToken.connect(vault).approve(betaProvider.address, balanceShares);
    await controller.connect(vault).withdraw(ETFnumber, protocolNumberDAI, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IDai.balanceOf(vaultAddr);

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(Number(formatDAI(vaultBalanceStart)), 2)
  });

  it("Should deposit and withdraw USDT to beta through controller", async function() {
    bToken = await erc20(iusdt);
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDt.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumberUSDT, vaultAddr, amountUSDT);
    const balanceShares = await betaProvider.balance(vaultAddr, iusdt);
    const balanceUnderlying = await betaProvider.balanceUnderlying(vaultAddr, iusdt);
    const calcShares = await betaProvider.calcShares(balanceUnderlying, iusdt);
    const vaultBalance = await IUSDt.balanceOf(vaultAddr);

    expect(Number(formatEther(calcShares))).to.be.closeTo(Number(formatEther(balanceShares)), 5);
    expect(balanceUnderlying).to.be.closeTo(amountUSDT, 5);
    expect(vaultBalanceStart.sub(vaultBalance)).to.equal(amountUSDT);

    console.log(`-------------------------Withdraw-------------------------`); 
    await bToken.connect(vault).approve(betaProvider.address, balanceShares);
    await controller.connect(vault).withdraw(ETFnumber, protocolNumberUSDT, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IUSDt.balanceOf(vaultAddr);

    expect(Number(formatDAI(vaultBalanceEnd))).to.be.closeTo(Number(formatDAI(vaultBalanceStart)), 2)
  });

  // it("Should fail when !controller is calling the Provider", async function() {
  //   await expect(betaProvider.connect(vault).deposit(vaultAddr, amountUSDC, iusdc, usdc))
  //   .to.be.revertedWith('ETFProvider: only controller');
  // });

  // it("Should fail when !Vault is calling the controller", async function() {
  //   await expect(controller.deposit(ETFnumber, protocolNumberUSDC, vaultAddr, amountUSDC))
  //   .to.be.revertedWith('Controller: only Vault');
  // });

  // it("Should get exchangeRate through controller", async function() {
  //   const exchangeRate = await controller.connect(vault).exchangeRate(ETFnumber, protocolNumberUSDC)
  //   console.log(`Exchange rate ${exchangeRate}`)
  // });
});