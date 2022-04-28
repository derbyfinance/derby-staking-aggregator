/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC } from '../helpers/helpers';
import type { ETFVaultMock } from '../../typechain-types';
import { MockContract } from "ethereum-waffle";
import { getAndLogBalances, rebalanceETF, setDeltaAllocations, setCurrentAllocations } from "../helpers/vaultHelpers";
import { beforeEachETFVault, Protocol } from "../helpers/vaultBeforeEach";

const name = 'XaverUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const uScale = 1E6;
const liquidityPerc = 10;
const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());


describe("Testing ETFVault, unit test", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolAave: Protocol,
  protocolYearn: Protocol,
  allProtocols: Protocol[],
  controller: Contract,
  yearnProvider: MockContract, 
  compoundProvider: MockContract, 
  aaveProvider: MockContract;

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn],
      allProtocols,
      IUSDc,
      yearnProvider, 
      compoundProvider, 
      aaveProvider,,
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

  it("Should be able to set the marginScale, liquidityPerc and performanceFee", async function() {
    const ms = Math.floor(Math.random() * 1E10);
    await vaultMock.connect(dao).setMarginScale(ms);

    expect(await vaultMock.getMarginScale()).to.be.equal(ms);

    const lp = Math.floor(Math.random() * 100);
    await vaultMock.connect(dao).setLiquidityPerc(lp);

    expect(await vaultMock.getLiquidityPerc()).to.be.equal(lp);

    const pf = Math.floor(Math.random() * 100);
    await vaultMock.connect(dao).setPerformanceFee(pf);

    expect(await vaultMock.getPerformanceFee()).to.be.equal(pf);
  });

  it("Should not be able to set the liquidityPerc or performanceFee higher than 100%", async function() {
    const lp = Math.floor(Math.random() * 100) * 1000;
    await expect(vaultMock.connect(dao).setLiquidityPerc(lp)).to.be.revertedWith('Percentage cannot exceed 100%');

    const pf = Math.floor(Math.random() * 100) * 1000;
    await expect(vaultMock.connect(dao).setPerformanceFee(pf)).to.be.revertedWith('Percentage cannot exceed 100%');
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

describe("Testing ETFVault, unit test, mock providers", async () => {
    let yearnProvider: MockContract, 
    compoundProvider: MockContract, 
    aaveProvider: MockContract, 
    vaultMock: ETFVaultMock,
    userAddr: string,
    IUSDc: Contract,
    user: Signer,
    allProtocols: Protocol[];
  
    beforeEach(async function() {
      [
        vaultMock,
        user,
        userAddr,
        ,
        allProtocols,
        IUSDc,
        yearnProvider, 
        compoundProvider, 
        aaveProvider
      ] = await beforeEachETFVault(amountUSDC, true);
    });
  
    it("Should store prices on rebalance", async function() {
        let compoundPrice = 1;
        let aavePrice = 2;
        let yearnPrice = 3;
        await Promise.all([
          yearnProvider.mock.exchangeRate.returns(yearnPrice),
          compoundProvider.mock.exchangeRate.returns(compoundPrice),
          aaveProvider.mock.exchangeRate.returns(aavePrice), 
          yearnProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
          compoundProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
          aaveProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
          yearnProvider.mock.deposit.returns(0), // to be able to use the rebalance function
          compoundProvider.mock.deposit.returns(0), // to be able to use the rebalance function
          aaveProvider.mock.deposit.returns(0), // to be able to use the rebalance function
          yearnProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
          compoundProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
          aaveProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
        ]);
    
        await setDeltaAllocations(user, vaultMock, allProtocols); 
        await vaultMock.depositETF(userAddr, amountUSDC);
        await rebalanceETF(vaultMock);

        let compoundHistoricalPrice = await vaultMock.historicalPrices(1, 0);
        let aaveHistoricalPrice = await vaultMock.historicalPrices(1, 2);
        let yearnHistoricalPrice = await vaultMock.historicalPrices(1, 4);
        expect(compoundPrice).to.be.equal(compoundHistoricalPrice);
        expect(aavePrice).to.be.equal(aaveHistoricalPrice);
        expect(yearnPrice).to.be.equal(yearnHistoricalPrice);
      });
});
