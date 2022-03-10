/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, routerAddProtocol, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, Router } from '../typechain-types';
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { deployAllProviders, getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, aave, yearn, compToken as comp} from "./helpers/addresses";
import exp from "constants";

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const marginScale = 1E9;
const uScale = 1E6;
const liquidityPerc = 10;
const amount = 100000;
const amountUSDC = parseUSDC(amount.toString());
let protocolCompound = { number: 0, allocation: 40, address: cusdc };
let protocolAave = { number: 0, allocation: 60, address: ausdc };
let protocolYearn = { number: 0, allocation: 20, address: yusdc };
let allProtocols = [protocolCompound, protocolAave, protocolYearn];

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, router: Router, dao: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, user: Signer, userAddr: string, vaultMock: ETFVaultMock;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress(); // mock address for game
    router = await deployRouter(dao, daoAddr);

    // Deploy vault and all providers
    [vaultMock, [yearnProvider, compoundProvider, aaveProvider], USDCSigner, IUSDc] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, userAddr, router.address, usdc, uScale, marginScale, liquidityPerc),
      deployAllProviders(dao, router),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    [protocolCompound.number, protocolAave.number, protocolYearn.number] = await Promise.all([
      routerAddProtocol(router, compoundProvider.address, cusdc, usdc, comp),
      routerAddProtocol(router, aaveProvider.address, ausdc, usdc, aave),
      routerAddProtocol(router, yearnProvider.address, yusdc, usdc, yearn),
      router.addVault(vaultMock.address),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(2)),
    ]);
  });

  it("Should have a name and symbol", async function() {
    expect(await vaultMock.name()).to.be.equal(name);
    expect(await vaultMock.symbol()).to.be.equal(symbol);
    expect(await vaultMock.decimals()).to.be.equal(decimals);
  });

  it("Should set delta allocations", async function() {
    await setDeltaAllocations(user, vaultMock, allProtocols);

    const [yearn, compound, aave] = await Promise.all([
      vaultMock.getDeltaAllocationTEST(protocolYearn.number),
      vaultMock.getDeltaAllocationTEST(protocolCompound.number),
      vaultMock.getDeltaAllocationTEST(protocolAave.number)
    ]);

    expect(yearn).to.be.equal(protocolYearn.allocation);
    expect(compound).to.be.equal(protocolCompound.allocation);
    expect(aave).to.be.equal(protocolAave.allocation);
  });

  it("Should deposit and rebalance", async function() {
    console.log('--------------depositing and rebalance with 100k ----------------')
    await setDeltaAllocations(user, vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();

    let LPBalanceUser = await vaultMock.balanceOf(userAddr);
    expect(LPBalanceUser).to.be.equal(amountUSDC);

    const [balances, allocations, totalAllocatedTokens, balanceVault] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      getAllocations(vaultMock, allProtocols),
      vaultMock.totalAllocatedTokens(),
      IUSDc.balanceOf(vaultMock.address)
    ]);

    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances[i].div(uScale))
      .to.be.closeTo(allocations[i].mul(amountUSDC.sub(balanceVault)).div(totalAllocatedTokens).div(uScale), 5)
    })
    // liquidity vault should be 100k * 10% = 10k
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(100_000 * liquidityPerc / 100, 1)

    console.log('--------------rebalancing with amount 0, withdraw 4k----------------')
    protocolYearn.allocation = 40;
    protocolCompound.allocation = -20;
    protocolAave.allocation = -20;
    allProtocols = [protocolYearn, protocolCompound, protocolAave];
    const amountToWithdraw = parseUSDC('12000');

    await vaultMock.withdrawETF(userAddr, amountToWithdraw);
    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.rebalanceETF();

    LPBalanceUser = await vaultMock.balanceOf(userAddr);
    expect(LPBalanceUser).to.be.equal(amountUSDC.sub(amountToWithdraw));

    const [balances2, allocations2, totalAllocatedTokens2, balanceVault2] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      getAllocations(vaultMock, allProtocols),
      vaultMock.totalAllocatedTokens(),
      IUSDc.balanceOf(vaultMock.address)
    ]);

    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances2[i].div(uScale))
      .to.be.closeTo(allocations2[i].mul(amountUSDC.sub(balanceVault2).sub(amountToWithdraw)).div(totalAllocatedTokens2).div(uScale), 5)
    })
    // liquidity vault should be 100k - 12k * 10% = 8.8k
    expect(Number(formatUSDC(balanceVault2))).to.be.closeTo((100_000 - 12_000)  * liquidityPerc / 100, 1)

    console.log('--------------rebalancing with amount 50k and Yearn to 0 ----------------')
    protocolYearn.allocation = -60;
    protocolCompound.allocation = 80;
    protocolAave.allocation = 40;
    allProtocols = [protocolYearn, protocolCompound, protocolAave];

    const amountToDeposit = parseUSDC('50000');
    const totalAmountDeposited = amountUSDC.add(amountToDeposit);

    await setDeltaAllocations(user, vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountToDeposit);
    await vaultMock.rebalanceETF();

    LPBalanceUser = await vaultMock.balanceOf(userAddr);
    console.log(`LP balance user: ${LPBalanceUser}`)
    expect(LPBalanceUser.div(1E6)).to.be.closeTo(amountUSDC.sub(amountToWithdraw).add(amountToDeposit).div(uScale), 5);

    const [balances3, allocations3, totalAllocatedTokens3, balanceVault3] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      getAllocations(vaultMock, allProtocols),
      vaultMock.totalAllocatedTokens(),
      IUSDc.balanceOf(vaultMock.address)
    ]);

    // Check if balanceInProtocol === currentAllocation / totalAllocated * totalAmountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances3[i].div(uScale))
      .to.be.closeTo(allocations3[i].mul((totalAmountDeposited.sub(balanceVault3).sub(amountToWithdraw))).div(totalAllocatedTokens3).div(uScale), 5)
    })
    // liquidity vault should be 100k - 12k + 50k * 10% = 13.8k
    expect(Number(formatUSDC(balanceVault3))).to.be.closeTo((100_000 - 12_000 + 50_000) * liquidityPerc / 100, 1)
  });

  it("Should be able to set the marginScale, uScale and liquidityPerc", async function() {
    const ms = Math.floor(Math.random() * 1E10);
    await vaultMock.connect(dao).setMarginScale(ms);

    expect(await vaultMock.getMarginScale()).to.be.equal(ms);

    const us = Math.floor(Math.random() * 1E10);
    await vaultMock.connect(dao).setUScale(us);

    expect(await vaultMock.getUScale()).to.be.equal(us);

    const lp = Math.floor(Math.random() * 100);
    await vaultMock.connect(dao).setLiquidityPerc(lp);

    expect(await vaultMock.getLiquidityPerc()).to.be.equal(lp);
  });

  it("Should not be able to set the liquidityPerc higher than 100%", async function() {
    const lp = Math.floor(Math.random() * 100) * 1000;
    await expect(vaultMock.connect(dao).setLiquidityPerc(lp)).to.be.revertedWith('Liquidity percentage cannot exceed 100%');
  });

  it.only("Should not deposit and withdraw when hitting the marginScale", async function() {
    console.log('-------------- depostit 100k, but for the 2nd protocol the margin gets hit ----------------');
    await setDeltaAllocations(user, vaultMock, allProtocols); // 0: compound: 40, 1: aave: 60, 2: yearn: 20

    await vaultMock.connect(dao).setMarginScale(26000*uScale); // set really high marginScale for testing

    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();

    let allocations = await getAllocations(vaultMock, allProtocols);
    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("allocations: 0: %s, 1: %s, 2: %s", allocations[0], allocations[1], allocations[2]);
    console.log("liquidity vault: %s", vaultBalance);
    let balances = await getAndLogBalances(vaultMock, allProtocols);
    let expectedBalances = [30000, 45000, 0];
    let expectedVaultLiquidity = 25000;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 1)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1)

    console.log('-------------- withdraw 35k, withdrawal should always be possible also when < marginScale ----------------');
    const amountToWithdraw = parseUSDC('35000');

    await vaultMock.withdrawETF(userAddr, amountToWithdraw);

    vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("allocations: 0: %s, 1: %s, 2: %s", allocations[0], allocations[1], allocations[2]);
    console.log("liquidity vault: %s", vaultBalance);
    balances = await getAndLogBalances(vaultMock, allProtocols);
    expectedBalances = [20000, 45000, 0];
    expectedVaultLiquidity = 0;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 1)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1)

    console.log('-------------- rebalance to 60 - 60 compound - aave, does not have any effect because margin ----------------');
    protocolCompound.allocation = 20; // compound: 60
    protocolAave.allocation = 0; // aave 60
    protocolYearn.allocation = -20; // yearn: 0

    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.rebalanceETF();

    allocations = await getAllocations(vaultMock, allProtocols);
    vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("allocations: 0: %s, 1: %s, 2: %s", allocations[0], allocations[1], allocations[2]);
    console.log("liquidity vault: %s", vaultBalance);
    balances = await getAndLogBalances(vaultMock, allProtocols);
    expectedBalances = [20000, 45000, 0];
    expectedVaultLiquidity = 0;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 1)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1)

    console.log('-------------- rebalance only has partial effect because margin ----------------');
    protocolCompound.allocation = -55; // compound: 5
    protocolAave.allocation = -40; // aave 20
    protocolYearn.allocation = 50; // yearn: 50

    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.rebalanceETF();

    allocations = await getAllocations(vaultMock, allProtocols);
    vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("allocations: 0: %s, 1: %s, 2: %s", allocations[0], allocations[1], allocations[2]);
    console.log("liquidity vault: %s", vaultBalance);
    balances = await getAndLogBalances(vaultMock, allProtocols);
    expectedBalances = [20000, 15600, 29400];
    expectedVaultLiquidity = 0;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 1)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);

    console.log('-------------- rebalance so that the withdrawals from yearn all end up in the liquidity of the vault ----------------');
    protocolCompound.allocation = 39; // compound: 44
    protocolAave.allocation = 24; // aave 44
    protocolYearn.allocation = -48; // yearn: 2

    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.rebalanceETF();

    allocations = await getAllocations(vaultMock, allProtocols);
    vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("allocations: 0: %s, 1: %s, 2: %s", allocations[0], allocations[1], allocations[2]);
    console.log("liquidity vault: %s", vaultBalance);
    balances = await getAndLogBalances(vaultMock, allProtocols);
    expectedBalances = [20000, 15600, 1300];
    expectedVaultLiquidity = 28100;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 1)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);

    console.log('-------------- everything to the vault ----------------');
    protocolCompound.allocation = -44; // compound: 0
    protocolAave.allocation = -44; // aave 0
    protocolYearn.allocation = -2; // yearn: 0

    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.rebalanceETF();

    allocations = await getAllocations(vaultMock, allProtocols);
    vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("allocations: 0: %s, 1: %s, 2: %s", allocations[0], allocations[1], allocations[2]);
    console.log("liquidity vault: %s", vaultBalance);
    balances = await getAndLogBalances(vaultMock, allProtocols);
    expectedBalances = [0, 0, 0];
    expectedVaultLiquidity = 65000;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 1)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
  });
});

