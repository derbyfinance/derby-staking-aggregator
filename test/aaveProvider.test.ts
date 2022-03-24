/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, routerAddProtocol, } from './helpers/helpers';
import type { AaveProvider, Router } from '../typechain-types';
import { deployAaveProvider, deployRouter } from './helpers/deploy';
import { usdc, aaveUSDC as ausdc, aave} from "./helpers/addresses";

const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());
const ETFnumber = 0;

describe("Deploy Contract and interact with Aave", async () => {
  let aaveProvider: AaveProvider, router: Router, dao: Signer, vault: Signer, USDCSigner: Signer, IUSDc: Contract, aToken: Contract, daoAddr: string, vaultAddr: string, protocolNumber: number;

  beforeEach(async function() {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    router = await deployRouter(dao, daoAddr);

    [vaultAddr, aaveProvider, USDCSigner, IUSDc, aToken] = await Promise.all([
      vault.getAddress(),
      deployAaveProvider(dao, router.address),
      getUSDCSigner(),
      erc20(usdc),
      erc20(ausdc),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to router contract
    [protocolNumber] = await Promise.all([
      routerAddProtocol(router, 'aave_usdc_01', ETFnumber, aaveProvider.address, ausdc, usdc, aave, 1E6.toString()),
      router.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(aaveProvider.address, amountUSDC)
    ])
  });

  it("Should deposit and withdraw to Aave through Router", async function() {
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await router.connect(vault).deposit(ETFnumber, protocolNumber, vaultAddr, amountUSDC);

    const aTokenbalance = await aaveProvider.balance(vaultAddr, ausdc);
    expect(Number(formatUSDC(aTokenbalance))).to.be.closeTo(amount, 1);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);
    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.be.closeTo(aTokenbalance, 1E6);

    console.log(`-------------------------Withdraw-------------------------`); 
    await aToken.connect(vault).approve(aaveProvider.address, aTokenbalance);
    await router.connect(vault).withdraw(ETFnumber, protocolNumber, vaultAddr, aTokenbalance);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10)
  });

  it("Should fail when !Router is calling the Provider", async function() {
    await expect(aaveProvider.connect(vault).deposit(vaultAddr, amountUSDC, ausdc, usdc))
    .to.be.revertedWith('ETFProvider: only router');
  });

  it("Should fail when !Vault is calling the Router", async function() {
    await expect(router.deposit(ETFnumber, protocolNumber, vaultAddr, amountUSDC))
    .to.be.revertedWith('Router: only Vault');
  });

  it("Should get exchangeRate through Router", async function() {
    const exchangeRate = await router.connect(vault).exchangeRate(ETFnumber, protocolNumber)
    console.log(`Exchange rate ${exchangeRate}`)
  });
});