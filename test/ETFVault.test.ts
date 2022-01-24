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

  // it("Should set delta allocations", async function() {
  //   await Promise.all([
  //     vault.setDeltaAllocation(protocolYearn[0], protocolYearn[1]),
  //     vault.setDeltaAllocation(protocolCompound[0], protocolCompound[1]),
  //     vault.setDeltaAllocation(protocolAave[0], protocolAave[1]),
  //   ]);

  //   const [yearn, compound, aave] = await Promise.all([
  //     vault.getDeltaAllocationTEST(protocolYearn[0]),
  //     vault.getDeltaAllocationTEST(protocolCompound[0]),
  //     vault.getDeltaAllocationTEST(protocolAave[0])
  //   ]);

  //   expect(yearn).to.be.equal(protocolYearn[1]);
  //   expect(compound).to.be.equal(protocolCompound[1]);
  //   expect(aave).to.be.equal(protocolAave[1]);
  // });

  it("Should deposit and rebalance", async function() {
    await Promise.all([
      vault.setDeltaAllocations(protocolYearn[0], protocolYearn[1]),
      vault.setDeltaAllocations(protocolCompound[0], protocolCompound[1]),
      vault.setDeltaAllocations(protocolAave[0], protocolAave[1]),
    ]);

    console.log('--------------depositing----------------')
    await vault.depositETF(userAddr, amountUSDC);
    
    const tx = await vault.rebalanceETF(amountUSDC);
    console.log(`Gas Used: ${utils.formatUnits(tx.gasLimit, 0)}`); // 1092938

    const [yearnBalance, compoundBalance, aaveBalance] = await Promise.all([
      vault.balanceUnderlying(protocolYearn[0]),
      vault.balanceUnderlying(protocolCompound[0]),
      vault.balanceUnderlying(protocolAave[0])
    ])

    console.log(`Yearn balance vault ${yearnBalance}`);
    console.log(`Compound balance vault ${compoundBalance}`);
    console.log(`Aave balance vault ${aaveBalance}`);

    console.log('--------------rebalancing with amount 0----------------')
    protocolYearn = [1, 20];
    protocolCompound = [2, 0];
    protocolAave = [5, -20];

    await vault.depositETF(userAddr, amountUSDC);

    await Promise.all([
      vault.setDeltaAllocations(protocolYearn[0], protocolYearn[1]),
      vault.setDeltaAllocations(protocolCompound[0], protocolCompound[1]),
      vault.setDeltaAllocations(protocolAave[0], protocolAave[1]),
    ]);

    const tx2 = await vault.rebalanceETF(0);
    console.log(`Gas Used 2: ${utils.formatUnits(tx2.gasLimit, 0)}`); // 314613


    const [yearnBalance2, compoundBalance2, aaveBalance2] = await Promise.all([
      vault.balanceUnderlying(protocolYearn[0]),
      vault.balanceUnderlying(protocolCompound[0]),
      vault.balanceUnderlying(protocolAave[0])
    ])

    console.log(`Yearn balance vault ${yearnBalance2}`);
    console.log(`Compound balance vault ${compoundBalance2}`);
    console.log(`Aave balance vault ${aaveBalance2}`);

    console.log('--------------rebalancing with amount 50000 ----------------')
    protocolYearn = [1, -30];
    protocolCompound = [2, 80];
    protocolAave = [5, 40];

    await Promise.all([
      vault.setDeltaAllocations(protocolYearn[0], protocolYearn[1]),
      vault.setDeltaAllocations(protocolCompound[0], protocolCompound[1]),
      vault.setDeltaAllocations(protocolAave[0], protocolAave[1]),
    ]);

    const tx3 = await vault.rebalanceETF(parseUSDC('50000'));
    console.log(`Gas Used 3: ${utils.formatUnits(tx3.gasLimit, 0)}`); // 314613


    const [yearnBalance3, compoundBalance3, aaveBalance3] = await Promise.all([
      vault.balanceUnderlying(protocolYearn[0]),
      vault.balanceUnderlying(protocolCompound[0]),
      vault.balanceUnderlying(protocolAave[0])
    ])

    console.log(`Yearn balance vault ${yearnBalance3}`);
    console.log(`Compound balance vault ${compoundBalance3}`);
    console.log(`Aave balance vault ${aaveBalance3}`);
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
