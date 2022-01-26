/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet, utils } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVault, ERC20, Router } from '../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployAaveProvider, deployETFVault, deployRouter } from './helpers/deploy';
import { getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";

const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const yusdc = '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9';
const cusdc = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const ausdc = '0xBcca60bB61934080951369a648Fb03DF4F96263C';
const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
let protocolYearn = [1, 20];
let protocolCompound = [2, 40];
let protocolAave = [5, 60];
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, router: Router, dao: Signer, vault: ETFVault, USDCSigner: Signer, IUSDc: ERC20, daoAddr: string, user: Signer, userAddr: string;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress();
    router = await deployRouter(dao, daoAddr);

    // Deploy vault and all providers
    [vault, yearnProvider, compoundProvider, aaveProvider, USDCSigner, IUSDc] = await Promise.all([
      deployETFVault(dao, daoAddr, ETFNumber, router.address, usdc),
      deployYearnProvider(dao, yusdc, usdc, router.address),
      deployCompoundProvider(dao, cusdc, usdc, router.address),
      deployAaveProvider(dao, ausdc, router.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
      IUSDc.connect(user).approve(vault.address, amountUSDC.mul(2)),
      router.addProtocol(ETFNumber, protocolYearn[0], yearnProvider.address, vault.address),
      router.addProtocol(ETFNumber, protocolCompound[0], compoundProvider.address, vault.address),
      router.addProtocol(ETFNumber, protocolAave[0], aaveProvider.address, vault.address)
    ])
  });

  it("Should set delta allocations", async function() {
    await setDeltaAllocations(vault, allProtocols);

    const [yearn, compound, aave] = await Promise.all([
      vault.getDeltaAllocationTEST(protocolYearn[0]),
      vault.getDeltaAllocationTEST(protocolCompound[0]),
      vault.getDeltaAllocationTEST(protocolAave[0])
    ]);

    expect(yearn).to.be.equal(protocolYearn[1]);
    expect(compound).to.be.equal(protocolCompound[1]);
    expect(aave).to.be.equal(protocolAave[1]);
  });

  it("Should deposit and rebalance", async function() {
    console.log('--------------depositing and rebalance with 100k ----------------')
    await setDeltaAllocations(vault, allProtocols);

    await vault.depositETF(userAddr, amountUSDC);
    await vault.rebalanceETF(amountUSDC);

    const balances = await getAndLogBalances(vault, allProtocols);
    const allocations = await getAllocations(vault, allProtocols);
    const totalAllocatedTokens = await vault.totalAllocatedTokens();

    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances[i].div(1E6))
      .to.be.closeTo(allocations[i].mul(amountUSDC).div(totalAllocatedTokens).div(1E6), 5)
    })

    console.log('--------------rebalancing with amount 0----------------')
    protocolYearn = [1, 40];
    protocolCompound = [2, -20];
    protocolAave = [5, -20];
    allProtocols = [protocolYearn, protocolCompound, protocolAave];

    await setDeltaAllocations(vault, allProtocols);

    await vault.rebalanceETF(0);

    const balances2 = await getAndLogBalances(vault, allProtocols);
    const allocations2 = await getAllocations(vault, allProtocols);
    const totalAllocatedTokens2 = await vault.totalAllocatedTokens();

    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances2[i].div(1E6))
      .to.be.closeTo(allocations2[i].mul(amountUSDC).div(totalAllocatedTokens2).div(1E6), 5)
    })

    console.log('--------------rebalancing with amount 50k and Yearn to 0 ----------------')
    protocolYearn = [1, -60]; // to 0
    protocolCompound = [2, 80];
    protocolAave = [5, 40];
    allProtocols = [protocolYearn, protocolCompound, protocolAave];
    const amountToDeposit = parseUSDC('50000');
    const totalAmountDeposited = amountUSDC.add(amountToDeposit)

    await setDeltaAllocations(vault, allProtocols);

    await vault.depositETF(userAddr, amountToDeposit);
    await vault.rebalanceETF(amountToDeposit);

    const balances3 = await getAndLogBalances(vault, allProtocols);
    const allocations3 = await getAllocations(vault, allProtocols);
    const totalAllocatedTokens3 = await vault.totalAllocatedTokens();

    // Check if balanceInProtocol === currentAllocation / totalAllocated * totalAmountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances3[i].div(1E6))
      .to.be.closeTo(allocations3[i].mul(totalAmountDeposited).div(totalAllocatedTokens3).div(1E6), 5)
    })
  });

});
