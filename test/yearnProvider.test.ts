/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, ERC20, Router } from '../typechain-types';
import { deployYearnProvider, deployRouter } from './helpers/deploy';

const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const yusdc = '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9';
const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
const protocolNumber = 1;

describe("Deploy Contract and interact with Yearn", async () => {
  let yearnProvider: YearnProvider, router: Router, owner: Signer, vault: Signer, USDCSigner: Signer, IUSDc: ERC20, ownerAddr: string, vaultAddr: string;

  beforeEach(async function() {
    [owner, vault] = await ethers.getSigners();
    router = await deployRouter(owner);

    [ownerAddr, vaultAddr, yearnProvider, USDCSigner, IUSDc] = await Promise.all([
      owner.getAddress(),
      vault.getAddress(),
      deployYearnProvider(owner, yusdc, usdc, router.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to router contract
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(yearnProvider.address, amountUSDC),
      router.addProtocol(ETFNumber, protocolNumber, yearnProvider.address)
    ])
  });

  it("Should deposit and withdraw to Yearn through Router", async function() {
    console.log(`-------------------------Deposit-------------------------`); 
    await router.deposit(ETFNumber, protocolNumber, vaultAddr, amountUSDC);
    const balanceShares = Number(await yearnProvider.balance());
    const price = Number(await yearnProvider.exchangeRate());
    const amount = (balanceShares * price) / 1E12
    console.log(`token balance contract ${balanceShares}`)
    
    expect(amount).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(Number(vaultBalance)).to.be.equal(0)

    console.log(`-------------------------Withdraw-------------------------`); 
    await router.withdraw(ETFNumber, protocolNumber, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    console.log(`USDC balance vault ${formatUSDC(String(vaultBalanceEnd))}`);

    expect(Number(formatUSDC(String(vaultBalanceEnd)))).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);
  });

  it("Should fail when !router is calling the Provider", async function() {
    await expect(yearnProvider.connect(vault).deposit(vaultAddr, amountUSDC))
    .to.be.revertedWith('ETFrouter: only router');
  });

  it("Should get exchangeRate through Router", async function() {
    const exchangeRate = await router.exchangeRate(ETFNumber, protocolNumber)
    console.log(`Exchange rate ${exchangeRate}`)
  });
});