/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { CompoundProvider, ERC20, Router } from '../typechain-types';
import { deployCompoundProvider, deployRouter } from './helpers/deploy';

const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const cusdc = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
const protocolNumber = 2;

describe("Deploy Contract and interact with Compound", async () => {
  let compoundProvider: CompoundProvider, router: Router, dao: Signer, vault: Signer, USDCSigner: Signer, IUSDc: ERC20, daoAddr: string, vaultAddr: string;

  beforeEach(async function() {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    router = await deployRouter(dao, daoAddr);

    [vaultAddr, compoundProvider, USDCSigner, IUSDc] = await Promise.all([
      vault.getAddress(),
      deployCompoundProvider(dao, cusdc, usdc, router.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to router contract
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(compoundProvider.address, amountUSDC),
      router.addProtocol(ETFNumber, protocolNumber, compoundProvider.address, vaultAddr)
    ])
  });

  it("Should deposit and withdraw to Compound through Router", async function() {
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);
    
    await router.connect(vault).deposit(ETFNumber, protocolNumber, vaultAddr, amountUSDC);
    const balanceShares = Number(await compoundProvider.balance(vaultAddr));
    const price = Number(await compoundProvider.exchangeRate());
    const amount = (balanceShares * price) / 1E18
    
    expect(amount).to.be.closeTo(Number(amountUSDC), 2);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(Number(amountUSDC));

    console.log(`-------------------------Withdraw-------------------------`); 
    console.log(`balance shares ${balanceShares}`)
    await router.connect(vault).withdraw(ETFNumber, protocolNumber, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);

    expect(
      Number(vaultBalanceStart) - Number(vaultBalance))
      .to.be.closeTo(Number(amountUSDC), 2);
  });

  it("Should fail when !Router is calling the Provider", async function() {
    await expect(compoundProvider.connect(vault).deposit(vaultAddr, amountUSDC))
    .to.be.revertedWith('ETFProvider: only router');
  });

  it("Should fail when !Vault is calling the Router", async function() {
    await expect(router.deposit(ETFNumber, protocolNumber, vaultAddr, amountUSDC))
    .to.be.revertedWith('Router: only Vault');
  });

  it("Should get Compound exchangeRate through Router", async function() {
    const exchangeRate = await router.connect(vault).exchangeRate(ETFNumber, protocolNumber)
    console.log(`Exchange rate ${exchangeRate}`)
  });

});