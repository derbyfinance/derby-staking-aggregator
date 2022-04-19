/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC } from '../helpers/helpers';
import type { ETFVaultMock } from '../../typechain-types';
import { getAllocations, getAndLogBalances, rebalanceETF, setDeltaAllocations } from "../helpers/vaultHelpers";
import { beforeEachETFVault, Protocol } from "../helpers/vaultBeforeEach";

const name = 'XaverUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const marginScale = 1E9;
const uScale = 1E6;
const liquidityPerc = 10;
const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());

describe("Testing ETFVault", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolAave: Protocol,
  protocolYearn: Protocol,
  allProtocols: Protocol[],
  controller: Contract;

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn],
      allProtocols,
      IUSDc,,,,,
      controller,,,,,,,
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

  it("Should deposit / withdraw and rebalance with += 200k", async function() {
    const amount = 200_000;
    const amountUSDC = parseUSDC(amount.toString());

    console.log('--------------depositing and rebalance with 200k ----------------');
    let totalAllocatedTokens = 120;
    await setDeltaAllocations(user, vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountUSDC);
    let gasUsed = await rebalanceETF(vaultMock);
    let gasUsedUSDC = Number(formatUSDC(gasUsed));
    let totalGasUsed = gasUsedUSDC;

    let [balances, balanceVault, LPBalanceUser] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      IUSDc.balanceOf(vaultMock.address),
      vaultMock.balanceOf(userAddr)
    ]);

    let totalUnderlying = amount;
    let liquidityVault = totalUnderlying * liquidityPerc / 100; // 10% liq vault
    let underlyingProtocols = totalUnderlying - liquidityVault;
    let expectedBalances = [
      40 / totalAllocatedTokens * underlyingProtocols, // Compound
      60 / totalAllocatedTokens * underlyingProtocols, // Aave
      20 / totalAllocatedTokens * underlyingProtocols // Yearn
    ]
    
    expect(LPBalanceUser).to.be.equal(amountUSDC); // 200k
    // liquidity vault should be 200k * 10% = 20k
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault - gasUsedUSDC, 3); 
    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((_, i) => {
      expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 2);
    });

    console.log('--------------rebalancing after withdrawing 40k----------------');
    protocolCompound.allocation = -20; // = 20
    protocolAave.allocation = -20; // = 40
    protocolYearn.allocation = 40; // = 60
    await setDeltaAllocations(user, vaultMock, allProtocols);

    const amountToWithdrawUSDC = 40_000
    const amountToWithdraw = parseUSDC(amountToWithdrawUSDC.toString());

    let exchangeRate = await vaultMock.exchangeRate();
    let USDCWithdrawed = Number(formatUSDC(exchangeRate)) * amountToWithdrawUSDC
    
    await vaultMock.withdrawETF(userAddr, amountToWithdraw);

    gasUsed = await rebalanceETF(vaultMock);
    gasUsedUSDC = Number(formatUSDC(gasUsed));

    [balances, balanceVault, LPBalanceUser] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      IUSDc.balanceOf(vaultMock.address),
      vaultMock.balanceOf(userAddr)
    ]);

    totalUnderlying = amount - USDCWithdrawed - totalGasUsed;
    liquidityVault = totalUnderlying * liquidityPerc / 100; // 10% liq vault 
    underlyingProtocols = totalUnderlying - liquidityVault;
    expectedBalances = [
      20 / totalAllocatedTokens * underlyingProtocols, // Compound
      40 / totalAllocatedTokens * underlyingProtocols, // Aave
      60 / totalAllocatedTokens * underlyingProtocols // Yearn
    ];
    totalGasUsed += gasUsedUSDC;

    expect(LPBalanceUser).to.be.equal(amountUSDC.sub(amountToWithdraw)); // 200k - 40k = 160k
    // liquidity vault should be 200k - 40k = 160k * 10%
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault - gasUsedUSDC, 3); 
    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((_, i) => {
      expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 3);
    });

    console.log('--------------rebalancing with deposit of 60k and Yearn to 0 ----------------');
    protocolCompound.allocation = 80; // = 100
    protocolAave.allocation = 40; // = 80
    protocolYearn.allocation = -60; // = 0
    totalAllocatedTokens = 180;
    await setDeltaAllocations(user, vaultMock, allProtocols);

    const amountToDepositUSDC = 60_000
    const amountToDeposit = parseUSDC(amountToDepositUSDC.toString());

    exchangeRate = await vaultMock.exchangeRate();
    let totalSupply = amount - amountToWithdrawUSDC;
    let LPtokensReceived = (amountToDepositUSDC * totalSupply) / (totalUnderlying - gasUsedUSDC);
    
    await vaultMock.depositETF(userAddr, amountToDeposit);

    gasUsed = await rebalanceETF(vaultMock);
    gasUsedUSDC = Number(formatUSDC(gasUsed));

    [balances, balanceVault, LPBalanceUser] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      IUSDc.balanceOf(vaultMock.address),
      vaultMock.balanceOf(userAddr)
    ]);

    totalUnderlying = amount - USDCWithdrawed + amountToDepositUSDC - totalGasUsed;
    liquidityVault = totalUnderlying * liquidityPerc / 100; // 10% liq vault 
    underlyingProtocols = totalUnderlying - liquidityVault;
    expectedBalances = [
      100 / totalAllocatedTokens * underlyingProtocols, // Compound
      80 / totalAllocatedTokens * underlyingProtocols, // Aave
      0 / totalAllocatedTokens * underlyingProtocols // Yearn
    ];
    totalGasUsed += gasUsedUSDC;
    
    console.log({exchangeRate})
    console.log({LPBalanceUser})
    console.log({LPtokensReceived})
    console.log({totalGasUsed})
    console.log({balanceVault})
    console.log({expectedBalances})
    console.log({liquidityVault}) 
    console.log({underlyingProtocols}) 

    expect(Number(formatUSDC(LPBalanceUser))).to.be.closeTo(amount - amountToWithdrawUSDC + LPtokensReceived, 1); // 200k - 40k + 60k
    // liquidity vault should be 200k - 40k - gasused = 160k * 10%
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault - gasUsedUSDC, 3); 
    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((_, i) => {
      expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 3);
    });

    console.log('-------------- everything to the vault ----------------');
    protocolCompound.allocation = -100; // = 0
    protocolAave.allocation = -80; // = 0
    protocolYearn.allocation = -0; // = 0
    totalAllocatedTokens = 0;
    await setDeltaAllocations(user, vaultMock, allProtocols);

    gasUsed = await rebalanceETF(vaultMock);
    gasUsedUSDC = Number(formatUSDC(gasUsed));

    [balances, balanceVault, LPBalanceUser] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      IUSDc.balanceOf(vaultMock.address),
      vaultMock.balanceOf(userAddr)
    ]);

    totalUnderlying = amount - USDCWithdrawed + amountToDepositUSDC - totalGasUsed;
    expectedBalances = [
      0, // Compound
      0, // Aave
      0 // Yearn
    ];

    allProtocols.forEach((_, i) => {
      expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 3);
    });
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(totalUnderlying - gasUsedUSDC, 3);
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
    await expect(vaultMock.connect(dao).setLiquidityPerc(lp)).to.be.revertedWith('Percentage cannot exceed 100%');
  });

  it("Should not deposit and withdraw when hitting the marginScale", async function() {
    const amount = 100_000;
    const amountUSDC = parseUSDC(amount.toString());
    console.log('-------deposit 100k, but for the 3rd protocol (yearn) the margin gets hit--------');
    await setDeltaAllocations(user, vaultMock, allProtocols); 

    await vaultMock.connect(dao).setMarginScale(26000*uScale);

    await vaultMock.depositETF(userAddr, amountUSDC);
    let gasUsed = await rebalanceETF(vaultMock);
    let gasUsedUSDC = Number(formatUSDC(gasUsed));
    let totalGasUsed = gasUsedUSDC;

    let [balances, balanceVault] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      IUSDc.balanceOf(vaultMock.address),
    ]);

    let expectedBalances = [
      30_000, // Compound
      45_000, // Aave
      0 // Yearn
    ]
    let liquidityVault = 25_000 - gasUsedUSDC; 

    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault, 2); 

    allProtocols.forEach((_, i) => {
      expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 2);
    });

    console.log('--------withdraw 35k, withdrawal should always be possible also when < marginScale--------');
    const amountToWithdrawUSDC = 35_000;
    const amountToWithdraw = parseUSDC(amountToWithdrawUSDC.toString());

    await vaultMock.withdrawETF(userAddr, amountToWithdraw);

    let exchangeRate = await vaultMock.exchangeRate();
    let USDCWithdrawed = Number(formatUSDC(exchangeRate)) * amountToWithdrawUSDC;

    [balances, balanceVault] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      IUSDc.balanceOf(vaultMock.address),
    ]);

    expectedBalances = [
      30_000 - (USDCWithdrawed - liquidityVault), // Compound // withdraw from first protocol
      45_000, // Aave
      0 // Yearn
    ] 

    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(0, 2); 

    allProtocols.forEach((_, i) => {
      expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 2);
    });

    console.log('--------rebalance to 60 - 60 compound - aave, does not have any effect because margin-------');
    console.log('Since liquidity of the vault is 0 here, it should pull 10k from the first protocol for liq');
    protocolCompound.allocation = 20; // compound: 60
    protocolAave.allocation = 0; // aave 60
    protocolYearn.allocation = -20; // yearn: 0
    await setDeltaAllocations(user, vaultMock, allProtocols);

    gasUsed = await rebalanceETF(vaultMock);
    gasUsedUSDC = Number(formatUSDC(gasUsed));

    [balances, balanceVault] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      IUSDc.balanceOf(vaultMock.address),
    ]);

    // liquidity is 0, so a minimum of 10k should be pulled from protocols
    expectedBalances = [
      30_000 - (USDCWithdrawed - liquidityVault) - 10_000, // Compound // 10k liq
      45_000, // Aave
      0 // Yearn
    ]
    liquidityVault = 10_000 - gasUsedUSDC;
    totalGasUsed += gasUsedUSDC; 

    // liquidity is 0, so a minimum of 10k should be pulled from protocols
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault, 2); 

    allProtocols.forEach((_, i) => {
      expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 2);
    });

    console.log('----------rebalance only has partial effect because margin-----------');
    protocolCompound.allocation = -55; // compound: 5
    protocolAave.allocation = -40; // aave 20
    protocolYearn.allocation = 50; // yearn: 50
    await setDeltaAllocations(user, vaultMock, allProtocols);

    gasUsed = await rebalanceETF(vaultMock);
    gasUsedUSDC = Number(formatUSDC(gasUsed));

    [balances, balanceVault] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      IUSDc.balanceOf(vaultMock.address),
    ]);

    liquidityVault = 10_000 - gasUsedUSDC;
    expectedBalances = [
      359, // Compound  400 - totalGasUsed
      15539, // Aave  15600 - totalGasUsed
      38849 // Yearn  39000 - totalGasUsed
    ];
    totalGasUsed += gasUsedUSDC; 
    
    // liquidity is 0, so a minimum of 10k should be pulled from protocols
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault, 2); 

    allProtocols.forEach((_, i) => {
      expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 2);
    });

  });

  it("Should be able to blacklist protocol and pull all funds", async function() {
    await controller.addVault(dao.getAddress()); // use dao signer as vault signer
    await setDeltaAllocations(user, vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountUSDC);
    const gasUsed = await rebalanceETF(vaultMock);
    let gasUsedUSDC = Number(formatUSDC(gasUsed));

    await vaultMock.connect(dao).blacklistProtocol(0);

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("liquidity vault after blacklisting: %s", vaultBalance);
    let balances = await getAndLogBalances(vaultMock, allProtocols);
    let expectedBalances = [0, 45000, 15000];
    let expectedVaultLiquidity = 40000 - gasUsedUSDC;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 1)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
    
    expect(await controller.connect(dao).getProtocolBlacklist(0, 0)).to.be.true;
  });

  it("Should not be able to set delta on blacklisted protocol", async function() {
    await controller.addVault(dao.getAddress()); // use dao signer as vault signer
    await vaultMock.connect(dao).blacklistProtocol(0);
    await expect(vaultMock.connect(user).setDeltaAllocations(0, 30))
    .to.be.revertedWith('Protocol on blacklist');
  });

  it("Should not be able to rebalance in blacklisted protocol", async function() {
    await controller.addVault(dao.getAddress()); // use dao signer as vault signer
    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.connect(dao).blacklistProtocol(0);
    await vaultMock.depositETF(userAddr, amountUSDC);
    const gasUsed = await rebalanceETF(vaultMock);
    let gasUsedUSDC = Number(formatUSDC(gasUsed));

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    console.log("liquidity vault after blacklisting: %s", vaultBalance);
    let balances = await getAndLogBalances(vaultMock, allProtocols);
    let expectedBalances = [0, 45000, 15000];
    let expectedVaultLiquidity = 40000 - gasUsedUSDC;

    allProtocols.forEach((protocol, i) => {
      expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 2)
    });

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
    const result = await controller.connect(dao).getProtocolBlacklist(0, 0);
    expect(result).to.be.true;
  });
});