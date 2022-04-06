/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC } from './helpers/helpers';
import type { ETFVaultMock } from '../typechain-types';
import { getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
import { beforeEachETFVault, Protocol } from "./helpers/vaultBeforeEach";

const name = 'XaverUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const marginScale = 1E9;
const uScale = 1E6;
const liquidityPerc = 10;
const amount = 100000;
const amountUSDC = parseUSDC(amount.toString());

describe("Deploy Contracts and interact with Vault", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolAave: Protocol,
  protocolYearn: Protocol,
  allProtocols: Protocol[],
  router: Contract;

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn],
      allProtocols,
      IUSDc,,,,,
      router,,,,,,,
      dao
    ] = await beforeEachETFVault(amountUSDC)
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

    let expectedBalances = [12000, 26400, 39600];
    let expectedVaultLiquidity = 10_000;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances2[i].div(uScale))).to.be.closeTo(expectedBalances[i], 2)
    });
    // liquidity vault should be 100k - 12k * 10% = 8.8k
    expect(Number(formatUSDC(balanceVault2))).to.be.closeTo(expectedVaultLiquidity, 1)

    console.log('--------------rebalancing with amount 50k and Yearn to 0 ----------------')
    protocolYearn.allocation = -60;
    protocolCompound.allocation = 80;
    protocolAave.allocation = 40;

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

  it("Should be able to set the marginScale and liquidityPerc", async function() {
    const ms = Math.floor(Math.random() * 1E10);
    await vaultMock.connect(dao).setMarginScale(ms);

    expect(await vaultMock.getMarginScale()).to.be.equal(ms);

    const lp = Math.floor(Math.random() * 100);
    await vaultMock.connect(dao).setLiquidityPerc(lp);

    expect(await vaultMock.getLiquidityPerc()).to.be.equal(lp);
  });

  it("Should not be able to set the liquidityPerc higher than 100%", async function() {
    const lp = Math.floor(Math.random() * 100) * 1000;
    await expect(vaultMock.connect(dao).setLiquidityPerc(lp)).to.be.revertedWith('Liquidity percentage cannot exceed 100%');
  });

  it("Should not deposit and withdraw when hitting the marginScale", async function() {
    console.log('-------------- depostit 100k, but for the 3rd protocol (yearn) the margin gets hit ----------------');
    await setDeltaAllocations(user, vaultMock, allProtocols); 

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
    expectedBalances = [10000, 45000, 0];
    expectedVaultLiquidity = 10000;

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
    expectedBalances = [400, 15600, 39000];
    expectedVaultLiquidity = 10000;

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
    expectedBalances = [28600, 15600, 1300];
    expectedVaultLiquidity = 19500;

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

  it("Should be able to blacklist protocol and pull all funds", async function() {
    await router.addVault(dao.getAddress()); // use dao signer as vault signer
    await setDeltaAllocations(user, vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();

    await vaultMock.connect(dao).blacklistProtocol(0);

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("liquidity vault after blacklisting: %s", vaultBalance);
    let balances = await getAndLogBalances(vaultMock, allProtocols);
    let expectedBalances = [0, 45000, 15000];
    let expectedVaultLiquidity = 40000;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 1)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
    
    expect(await router.connect(dao).getProtocolBlacklist(0, 0)).to.be.true;
  });

  it("Should not be able to set delta on blacklisted protocol", async function() {
    await router.addVault(dao.getAddress()); // use dao signer as vault signer
    await vaultMock.connect(dao).blacklistProtocol(0);
    await expect(vaultMock.connect(user).setDeltaAllocations(0, 30))
    .to.be.revertedWith('Protocol is on the blacklist');
  });

  it("Should not be able to rebalance in blacklisted protocol", async function() {
    await router.addVault(dao.getAddress()); // use dao signer as vault signer
    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.connect(dao).blacklistProtocol(0);
    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("liquidity vault after blacklisting: %s", vaultBalance);
    let balances = await getAndLogBalances(vaultMock, allProtocols);
    let expectedBalances = [0, 45000, 15000];
    let expectedVaultLiquidity = 40000;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 1)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
    const result = await router.connect(dao).getProtocolBlacklist(0, 0);
    expect(result).to.be.true;
  });
});