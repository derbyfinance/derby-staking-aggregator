/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Contract, Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, ERC20, Router } from '../typechain-types';
import { deployYearnProvider, deployRouter } from './helpers/deploy';
import { usdc, yearnUSDC as yusdc} from "./helpers/addresses";

const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
const protocolNumber = 1;

describe("Deploy Contract and interact with Yearn", async () => {
  let yearnProvider: YearnProvider, router: Router, dao: Signer, vault: Signer, USDCSigner: Signer, IUSDc: Contract, yToken: Contract, daoAddr: string, vaultAddr: string;

  beforeEach(async function() {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    router = await deployRouter(dao, daoAddr);

    [vaultAddr, yearnProvider, USDCSigner, IUSDc, yToken] = await Promise.all([
      vault.getAddress(),
      deployYearnProvider(dao, yusdc, usdc, router.address),
      getUSDCSigner(),
      erc20(usdc),
      erc20(yusdc),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to router contract
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(yearnProvider.address, amountUSDC),
      router.addProtocol(ETFNumber, protocolNumber, yearnProvider.address, vaultAddr)
    ])
  });

  it("Should deposit and withdraw to Yearn through Router", async function() {
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await router.connect(vault).deposit(ETFNumber, protocolNumber, vaultAddr, amountUSDC);
    const balanceShares = Number(await yearnProvider.balance(vaultAddr));
    const price = Number(await yearnProvider.exchangeRate());
    const amount = (balanceShares * price) / 1E12
    
    expect(amount).to.be.closeTo(Number(formatUSDC(amountUSDC)), 2);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    console.log(`-------------------------Withdraw-------------------------`); 
    await yToken.connect(vault).approve(yearnProvider.address, balanceShares);
    await router.connect(vault).withdraw(ETFNumber, protocolNumber, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10)
  });

  it("Should fail when !Router is calling the Provider", async function() {
    await expect(yearnProvider.connect(vault).deposit(vaultAddr, amountUSDC))
    .to.be.revertedWith('ETFProvider: only router');
  });

  it("Should fail when !Vault is calling the Router", async function() {
    await expect(router.deposit(ETFNumber, protocolNumber, vaultAddr, amountUSDC))
    .to.be.revertedWith('Router: only Vault');
  });

  it("Should get exchangeRate through Router", async function() {
    const exchangeRate = await router.connect(vault).exchangeRate(ETFNumber, protocolNumber)
    console.log(`Exchange rate ${exchangeRate}`)
  });
  
});