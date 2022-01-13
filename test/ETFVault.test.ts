/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet, utils } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, ETFVault, ERC20, Router } from '../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployETFVault, deployRouter } from './helpers/deploy';

const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const yusdc = '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9';
const cusdc = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
const protocolYearn = [1, 20];
const protocolCompound = [2, 40];
const protocolAave = [5, 60];

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, router: Router, dao: Signer, vault: ETFVault, USDCSigner: Signer, IUSDc: ERC20, daoAddr: string, user: Signer, userAddr: string;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress();
    router = await deployRouter(dao, daoAddr);

    [vault, yearnProvider, compoundProvider, USDCSigner, IUSDc] = await Promise.all([
      deployETFVault(dao, daoAddr, ETFNumber, router.address, usdc),
      deployYearnProvider(dao, yusdc, usdc, router.address),
      deployCompoundProvider(dao, cusdc, usdc, router.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
      router.addProtocol(ETFNumber, protocolYearn[0], yearnProvider.address, vault.address),
      router.addProtocol(ETFNumber, protocolCompound[0], compoundProvider.address, vault.address),
      router.addProtocol(ETFNumber, protocolAave[0], compoundProvider.address, vault.address)
    ])
  });

  it("Should set allocations", async function() {
    await vault.setAllocatedTokens([
      protocolYearn,
      protocolCompound,
      protocolAave
    ]);
    const [yearn, compound, aave] = await Promise.all([
      vault.getAllocationTEST(protocolYearn[0]),
      vault.getAllocationTEST(protocolCompound[0]),
      vault.getAllocationTEST(protocolAave[0])
    ]);

    const protocolsInETF = await vault.getProtocolsInETF();
    console.log(`protocolsInEtf ${protocolsInETF}`);

    expect(yearn).to.be.equal(protocolYearn[1]);
    expect(compound).to.be.equal(protocolCompound[1]);
    expect(aave).to.be.equal(protocolAave[1]);

    console.log('--------------depositing----------------')

    const tx = await vault.depositETF(userAddr, amountUSDC);
    console.log(`Gas Used: ${utils.formatUnits(tx.gasLimit, 0)}`);

    const compoundBalance = await vault.balance(protocolCompound[0]);
    console.log(`Compound balance vault ${compoundBalance}`);

    const yearnBalance = await vault.balance(protocolYearn[0]);
    console.log(`Yearn balance vault ${yearnBalance}`);
    
    const aaveBalance = await vault.balance(protocolAave[0]);
    console.log(`Aave balance vault ${aaveBalance}`);
  });

  // it("Should deposit to both providers", async function() {
  //   const tx = await vault.depositETF(userAddr, amountUSDC);
  //   console.log(`Gas Used: ${utils.formatUnits(tx.gasLimit, 0)}`);

  //   const compoundBalance = await vault.balance(protocolCompound);
  //   console.log(`Compound balance vault ${compoundBalance}`);

  //   const yearnBalance = await vault.balance(protocolYearn);
  //   console.log(`Yearn balance vault ${yearnBalance}`);

  // });
});