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
  let yearnProvider: YearnProvider, owner: Signer, addr1: Signer, USDCSigner: Signer, IUSDc: ERC20, ownerAddr: string, addr1Addr: string;

  beforeEach(async function() {
    [owner, addr1] = await ethers.getSigners();
    ownerAddr = await owner.getAddress();
    addr1Addr = await addr1.getAddress();

    yearnProvider = await deployYearnProvider(owner, yusdc, usdc, addr1Addr);

    USDCSigner = await getUSDCSigner();
    IUSDc = await erc20(usdc);
  });

  it("Should deposit tokens to Yearn", async function() {
    const amountUSDC = parseUSDC('100000'); // 100k

    await IUSDc.connect(USDCSigner).transfer(addr1Addr, amountUSDC);
    await IUSDc.connect(addr1).approve(yearnProvider.address, amountUSDC);

    console.log(`-------------------------Deposit-------------------------`)  
    await yearnProvider.connect(addr1).depositEtf(addr1Addr, amountUSDC);
    const balance = await yearnProvider.balance();

    console.log(`token balance contract ${formatUSDC(String(balance))}`)
    console.log(formatUSDC(amountUSDC));

    console.log(`-------------------------Withdraw-------------------------`) 
    await yearnProvider.connect(addr1).withdrawEtf(addr1Addr, balance);
    const balanceAfter = await yearnProvider.balance();

    const USDCBalance = await IUSDc.balanceOf(addr1Addr);
    console.log(`USDC balance addr1 ${formatUSDC(String(USDCBalance))}`)
  });
});