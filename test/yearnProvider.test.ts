/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, routerAddProtocol, } from './helpers/helpers';
import type { YearnProvider, Router } from '../typechain-types';
import { deployYearnProvider, deployRouter } from './helpers/deploy';
import { usdc, yearnUSDC as yusdc, yearn} from "./helpers/addresses";

const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());

describe("Deploy Contract and interact with Yearn", async () => {
  let yearnProvider: YearnProvider, router: Router, dao: Signer, vault: Signer, USDCSigner: Signer, IUSDc: Contract, yToken: Contract, daoAddr: string, vaultAddr: string, protocolNumber: number;

  beforeEach(async function() {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    router = await deployRouter(dao, daoAddr);

    [vaultAddr, yearnProvider, USDCSigner, IUSDc, yToken] = await Promise.all([
      vault.getAddress(),
      deployYearnProvider(dao, router.address),
      getUSDCSigner(),
      erc20(usdc),
      erc20(yusdc),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to router contract
    [protocolNumber] = await Promise.all([
      routerAddProtocol(router, yearnProvider.address, yusdc, usdc, yearn),
      router.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(yearnProvider.address, amountUSDC),
    ])
  });

  it("Should deposit and withdraw to Yearn through Router", async function() {
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await router.connect(vault).deposit( protocolNumber, vaultAddr, amountUSDC);
    const balanceShares = Number(await yearnProvider.balance(vaultAddr, yusdc));
    const price = Number(await yearnProvider.exchangeRate(yusdc));
    const amount = (balanceShares * price) / 1E12
    
    expect(amount).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    console.log(`-------------------------Withdraw-------------------------`); 
    await yToken.connect(vault).approve(yearnProvider.address, balanceShares);
    await router.connect(vault).withdraw( protocolNumber, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10)
  });

  it("Should fail when !Router is calling the Provider", async function() {
    await expect(yearnProvider.connect(vault).deposit(vaultAddr, amountUSDC, yusdc, usdc))
    .to.be.revertedWith('ETFProvider: only router');
  });

  it("Should fail when !Vault is calling the Router", async function() {
    await expect(router.deposit( protocolNumber, vaultAddr, amountUSDC))
    .to.be.revertedWith('Router: only Vault');
  });

  it("Should get exchangeRate through Router", async function() {
    const exchangeRate = await router.connect(vault).exchangeRate( protocolNumber)
    console.log(`Exchange rate ${exchangeRate}`)
  });
  
});