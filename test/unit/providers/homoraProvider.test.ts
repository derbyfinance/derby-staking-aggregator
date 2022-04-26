/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, controllerAddProtocol, } from '../../helpers/helpers';
import type { HomoraProvider, Controller } from '../../../typechain-types';
import { deployHomoraProvider, deployController } from '../../helpers/deploy';
import { usdc, homoraUSDC as husdc, yearn} from "../../helpers/addresses";

const amount = 100_000;
// const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());
const ETFnumber = 0;

// change naming
describe("Testing Homora provider", async () => {
  let homoraProvider: HomoraProvider, controller: Controller, dao: Signer, vault: Signer, USDCSigner: Signer, IUSDc: Contract, hToken: Contract, daoAddr: string, vaultAddr: string, protocolNumber: number;

  beforeEach(async function() {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, homoraProvider, USDCSigner, IUSDc, hToken] = await Promise.all([
      vault.getAddress(),
      deployHomoraProvider(dao, controller.address),
      getUSDCSigner(),
      erc20(usdc),
      erc20(husdc),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to controller contract
    [protocolNumber] = await Promise.all([
      controllerAddProtocol(controller, 'homora_usdc_01', ETFnumber, homoraProvider.address, husdc, usdc, yearn, 1E6.toString()),
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(homoraProvider.address, amountUSDC),
    ])
  });

  it("Should deposit and withdraw to Homora through controller", async function() {
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumber, vaultAddr, amountUSDC);
    // const balanceShares = Number(await homoraProvider.balance(vaultAddr, yusdc));
    // const price = Number(await homoraProvider.exchangeRate(yusdc));
    // const amount = (balanceShares * price) / 1E12
    
    // expect(amount).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);

    // const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    // expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    // console.log(`-------------------------Withdraw-------------------------`); 
    // await yToken.connect(vault).approve(homoraProvider.address, balanceShares);
    // await controller.connect(vault).withdraw(ETFnumber, protocolNumber, vaultAddr, balanceShares);

    // const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    // expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10)
  });

  // it("Should fail when !controller is calling the Provider", async function() {
  //   await expect(homoraProvider.connect(vault).deposit(vaultAddr, amountUSDC, yusdc, usdc))
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