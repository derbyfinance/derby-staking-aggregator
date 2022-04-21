/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, controllerAddProtocol, } from '../helpers/helpers';
import type { TruefiProvider, Controller } from '../../typechain-types';
import { deployTruefiProvider, deployController } from '../helpers/deploy';
import { usdc, truefiUSDC as tusdc, truefi} from "../helpers/addresses";

const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());
const ETFnumber = 0;

describe("Testing TrueFi provider", async () => {
  let truefiProvider: TruefiProvider, controller: Controller, dao: Signer, vault: Signer, USDCSigner: Signer, IUSDc: Contract, tToken: Contract, daoAddr: string, vaultAddr: string, protocolNumber: number;

  beforeEach(async function() {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, truefiProvider, USDCSigner, IUSDc, tToken] = await Promise.all([
      vault.getAddress(),
      deployTruefiProvider(dao, controller.address),
      getUSDCSigner(),
      erc20(usdc),
      erc20(tusdc),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to controller contract
    [protocolNumber] = await Promise.all([
      controllerAddProtocol(controller, 'truefi_usdc_01', ETFnumber, truefiProvider.address, tusdc, usdc, truefi, 1E6.toString()),
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(truefiProvider.address, amountUSDC),
    ]);
  });

  it.only("Should deposit and withdraw to Truefi through controller", async function() {
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumber, vaultAddr, amountUSDC);
    // const balanceShares = Number(await truefiProvider.balance(vaultAddr, tusdc));
    // const price = Number(await truefiProvider.exchangeRate(tusdc));
    // const amount = (balanceShares * price) / 1E12

    console.log({vaultBalanceStart})
    
    // expect(amount).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);

    // const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    // expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    // console.log(`-------------------------Withdraw-------------------------`); 
    // await yToken.connect(vault).approve(yearnProvider.address, balanceShares);
    // await controller.connect(vault).withdraw(ETFnumber, protocolNumber, vaultAddr, balanceShares);

    // const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    // expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10)
  });

  // it("Should fail when !controller is calling the Provider", async function() {
  //   await expect(yearnProvider.connect(vault).deposit(vaultAddr, amountUSDC, yusdc, usdc))
  //   .to.be.revertedWith('ETFProvider: only controller');
  // });

  // it("Should fail when !Vault is calling the controller", async function() {
  //   await expect(controller.deposit(ETFnumber, protocolNumber, vaultAddr, amountUSDC))
  //   .to.be.revertedWith('Controller: only Vault');
  // });

  // it("Should get exchangeRate through controller", async function() {
  //   const exchangeRate = await controller.connect(vault).exchangeRate(ETFnumber, protocolNumber)
  //   console.log(`Exchange rate ${exchangeRate}`)
  // });
  
});