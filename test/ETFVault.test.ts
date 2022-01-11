/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, ETFVault, ERC20, Router } from '../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployETFVault, deployRouter } from './helpers/deploy';

const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const yusdc = '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9';
const cusdc = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
const protocolYearn = 1;
const protocolCompound = 2;

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, router: Router, dao: Signer, vault: ETFVault, USDCSigner: Signer, IUSDc: ERC20, daoAddr: string, user: Signer, userAddr: string;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress();
    router = await deployRouter(dao, daoAddr);

    [vault, yearnProvider, compoundProvider, USDCSigner, IUSDc] = await Promise.all([
      deployETFVault(dao, ETFNumber, router.address, usdc),
      deployYearnProvider(dao, yusdc, usdc, router.address),
      deployCompoundProvider(dao, cusdc, usdc, router.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer and approve USDC to vault AND add protocol to router contract
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
      router.addProtocol(ETFNumber, protocolYearn, yearnProvider.address, vault.address),
      router.addProtocol(ETFNumber, protocolCompound, compoundProvider.address, vault.address)
    ])
  });

  it("Should deposit to both providers", async function() {
    console.log('test')
    expect(2).to.be.equal(2)
  });

  
});