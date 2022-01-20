/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet, utils } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVault, ERC20, Router } from '../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployAaveProvider, deployETFVault, deployRouter } from './helpers/deploy';

const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const yusdc = '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9';
const cusdc = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const ausdc = '0xBcca60bB61934080951369a648Fb03DF4F96263C';
const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
let protocolYearn = [1, 20];
let protocolCompound = [2, 40];
let protocolAave = [5, 60];

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, router: Router, dao: Signer, vault: ETFVault, USDCSigner: Signer, IUSDc: ERC20, daoAddr: string, user: Signer, userAddr: string;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress();
    router = await deployRouter(dao, daoAddr);

    [vault, yearnProvider, compoundProvider, aaveProvider, USDCSigner, IUSDc] = await Promise.all([
      deployETFVault(dao, daoAddr, ETFNumber, router.address, usdc),
      deployYearnProvider(dao, yusdc, usdc, router.address),
      deployCompoundProvider(dao, cusdc, usdc, router.address),
      deployAaveProvider(dao, ausdc, router.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
      IUSDc.connect(user).approve(vault.address, amountUSDC.mul(2)),
      router.addProtocol(ETFNumber, protocolYearn[0], yearnProvider.address, vault.address),
      router.addProtocol(ETFNumber, protocolCompound[0], compoundProvider.address, vault.address),
      router.addProtocol(ETFNumber, protocolAave[0], aaveProvider.address, vault.address)
    ])
  });

  it("Should set allocations, deposit and rebalance", async function() {
    await vault.setAllocations([
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

    await vault.rebalanceETF(amountUSDC);

    const yearnBalance = await vault.balanceUnderlying(protocolYearn[0]);
    console.log(`Yearn balance vault ${yearnBalance}`);

    const compoundBalance = await vault.balanceUnderlying(protocolCompound[0]);
    console.log(`Compound balance vault ${compoundBalance}`);

    const aaveBalance = await vault.balanceUnderlying(protocolAave[0]);
    console.log(`Aave balance vault ${aaveBalance}`);

    console.log('--------------rebalancing----------------')
    protocolYearn = [1, 40];
    protocolAave = [5, 40];

    await vault.depositETF(userAddr, amountUSDC);

    await vault.setAllocations([
      protocolYearn,
      protocolCompound,
      protocolAave
    ]);

    await vault.rebalanceETF(amountUSDC);

    const yearnBalance2 = await vault.balanceUnderlying(protocolYearn[0]);
    console.log(`Yearn balance vault ${yearnBalance2}`);

    const compoundBalance2 = await vault.balanceUnderlying(protocolCompound[0]);
    console.log(`Compound balance vault ${compoundBalance2}`);

    const aaveBalance2 = await vault.balanceUnderlying(protocolAave[0]);
    console.log(`Aave balance vault ${aaveBalance2}`);
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