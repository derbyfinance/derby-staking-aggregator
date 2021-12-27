/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, ERC20 } from '../typechain-types';
import { deployYearnProvider } from './helpers/deploy';

const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const yusdc = '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9'

describe("Deploy Contract and interact with Yearn", async () => {
  let yearnProvider: YearnProvider, owner: Signer, vault: Signer, USDCSigner: Signer, IUSDc: ERC20, ownerAddr: string, vaultAddr: string;

  beforeEach(async function() {
    [owner, vault] = await ethers.getSigners();
    vaultAddr = await vault.getAddress();

    [ownerAddr, yearnProvider, USDCSigner, IUSDc] = await Promise.all([
      owner.getAddress(),
      deployYearnProvider(owner, yusdc, usdc, vaultAddr),
      getUSDCSigner(),
      erc20(usdc)
    ]);
  });

  it("Should deposit and withdraw tokens to Yearn", async function() {
    const amountUSDC = parseUSDC('100000'); // 100k

    await IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC);
    await IUSDc.connect(vault).approve(yearnProvider.address, amountUSDC);

    console.log(`-------------------------Deposit-------------------------`);  
    await yearnProvider.connect(vault).deposit(vaultAddr, amountUSDC);
    const balanceShares = Number(await yearnProvider.balance());
    const price = Number(await yearnProvider.exchangeRate());
    const amount = (balanceShares * price) / 1E12

    console.log(`token balance contract ${balanceShares}`)
    expect(amount).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);

    console.log(`-------------------------Withdraw-------------------------`); 
    await yearnProvider.connect(vault).withdraw(vaultAddr, balanceShares);

    const USDCBalance = await IUSDc.balanceOf(vaultAddr);
    console.log(`USDC balance vault ${formatUSDC(String(USDCBalance))}`);

    expect(Number(formatUSDC(String(USDCBalance)))).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);
  });
});