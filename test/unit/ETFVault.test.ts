/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { erc20, formatUSDC, getUSDCSigner, parseUSDC } from '../helpers/helpers';
import type { Controller, ETFVaultMock } from '../../typechain-types';
import { deployController, deployETFVaultMock } from '../helpers/deploy';
import { usdc, yearn_usdc_01, compound_usdc_01, aave_usdc_01 } from "../helpers/addresses";
import { initController, rebalanceETF } from "../helpers/vaultHelpers";
import allProviders  from "../helpers/allProvidersClass";
import AllMockProviders from "../helpers/allMockProvidersClass";
import { ethers } from "hardhat";
import { ProtocolVault } from "@testhelp/protocolVaultClass";


const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const name = 'XaverUSDC';
const symbol = 'dUSDC';
const ETFname = 'USDC_med_risk';
const ETFnumber = 0;
const decimals = 6;
const uScale = 1E6;
const liquidityPerc = 10;
const gasFeeLiquidity = 10_000 * uScale;


describe("Testing ETFVault, unit test", async () => {
  let vault: ETFVaultMock, controller: Controller, dao: Signer, game: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, gameAddr: string;

  const protocols = new Map<string, ProtocolVault>()
  .set('compound_usdc_01', compound_usdc_01)
  .set('aave_usdc_01', aave_usdc_01)
  .set('yearn_usdc_01', yearn_usdc_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  beforeEach(async function() {
    [dao, game] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, gameAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      game.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, gameAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    await Promise.all([
      initController(controller, [gameAddr, vault.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(gameAddr, amountUSDC),
      IUSDc.connect(game).approve(vault.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, ETFnumber, allProviders);
    }
  });

  it("Should have a name and symbol", async function() {
    expect(await vault.name()).to.be.equal(name);
    expect(await vault.symbol()).to.be.equal(symbol);
    expect(await vault.decimals()).to.be.equal(decimals);
  });

  it("Should set delta allocations", async function() {
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, game, 40),
      aaveVault.setDeltaAllocation(vault, game, 60),
      yearnVault.setDeltaAllocation(vault, game, 20),
    ]);

    for (const protocol of protocols.values()) {
      const deltaAllocation = await protocol.getDeltaAllocationTEST(vault);
      expect(deltaAllocation).to.be.greaterThan(0);
      expect(deltaAllocation).to.be.equal(protocol.allocation);
    };
  });

  it("Should be able to set the marginScale, liquidityPerc and performanceFee", async function() {
    const ms = Math.floor(Math.random() * 1E10);
    await vault.connect(dao).setMarginScale(ms);

    expect(await vault.getMarginScale()).to.be.equal(ms);

    const lp = Math.floor(Math.random() * 100);
    await vault.connect(dao).setLiquidityPerc(lp);

    expect(await vault.getLiquidityPerc()).to.be.equal(lp);

    const pf = Math.floor(Math.random() * 100);
    await vault.connect(dao).setPerformanceFee(pf);

    expect(await vault.getPerformanceFee()).to.be.equal(pf);
  });

  it("Should not be able to set the liquidityPerc or performanceFee higher than 100%", async function() {
    const lp = Math.floor(Math.random() * 100) * 1000;
    await expect(vault.connect(dao).setLiquidityPerc(lp)).to.be.revertedWith('Percentage cannot exceed 100%');

    const pf = Math.floor(Math.random() * 100) * 1000;
    await expect(vault.connect(dao).setPerformanceFee(pf)).to.be.revertedWith('Percentage cannot exceed 100%');
  });

  it("Should be able to blacklist protocol and pull all funds", async function() {
    await Promise.all([
      compoundVault
        .setExpectedBalance(0)
        .setDeltaAllocation(vault, game, 40),
      aaveVault
        .setExpectedBalance(45_000)
        .setDeltaAllocation(vault, game, 60),
      yearnVault
        .setExpectedBalance(15_000)
        .setDeltaAllocation(vault, game, 20),
    ]);
    
    await vault.depositETF(gameAddr, amountUSDC);
    const gasUsed = await rebalanceETF(vault);
    let gasUsedUSDC = formatUSDC(gasUsed);

    // blacklist compound_usdc_01
    await vault.connect(dao).blacklistProtocol(compoundVault!.number);

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vault.address));
    console.log("liquidity vault after blacklisting: %s", vaultBalance);

    let expectedVaultLiquidity = 40000 - gasUsedUSDC;

    for (const protocol of protocols.values()) {
      const balance = await protocol.balanceUnderlying(vault);
      console.log(protocol.number, balance, protocol.name)
      expect(formatUSDC(balance)).to.be.closeTo(protocol.expectedBalance, 1)
    };

    expect(vaultBalance).to.be.closeTo(expectedVaultLiquidity, 1);
    expect(await controller.connect(game).getProtocolBlacklist(0, 0)).to.be.true;
  });

  it("Should not be able to set delta on blacklisted protocol", async function() {
    await controller.addVault(daoAddr); // use dao signer as vault signer
    await vault.connect(dao).blacklistProtocol(0);
    await expect(vault.connect(game).setDeltaAllocations(0, 30))
    .to.be.revertedWith('Protocol on blacklist');
  });

  it("Should not be able to rebalance in blacklisted protocol", async function() {
    await controller.addVault(daoAddr); // use dao signer as vault signer

    await Promise.all([
      compoundVault
        .setExpectedBalance(0)
        .setDeltaAllocation(vault, game, 40),
      aaveVault
        .setExpectedBalance(45_000)
        .setDeltaAllocation(vault, game, 60),
      yearnVault
        .setExpectedBalance(15_000)
        .setDeltaAllocation(vault, game, 20),
    ]);

    await vault.connect(dao).blacklistProtocol(compoundVault!.number);
    await vault.depositETF(gameAddr, amountUSDC);

    const gasUsed = await rebalanceETF(vault);
    let gasUsedUSDC = formatUSDC(gasUsed);

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vault.address));
    console.log("liquidity vault after blacklisting: %s", vaultBalance);

    let expectedVaultLiquidity = 40000 - gasUsedUSDC;

    for (const protocol of protocols.values()) {
      const balance = await protocol.balanceUnderlying(vault);
      expect(formatUSDC(balance)).to.be.closeTo(protocol.expectedBalance, 1)
    };

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
    const result = await controller.connect(dao).getProtocolBlacklist(0, 0);
    expect(result).to.be.true;
  });
});

describe("Testing ETFVault, unit test, mock providers", async () => {
  let vault: ETFVaultMock, controller: Controller, dao: Signer, game: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, gameAddr: string;
  
  const protocols = new Map<string, ProtocolVault>()
  .set('compound_usdc_01', compound_usdc_01)
  .set('aave_usdc_01', aave_usdc_01)
  .set('yearn_usdc_01', yearn_usdc_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  beforeEach(async function() {
    [dao, game] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, gameAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      game.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, gameAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    // With MOCK Providers
    await Promise.all([
      initController(controller, [gameAddr, vault.address]),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(gameAddr, amountUSDC),
      IUSDc.connect(game).approve(vault.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, ETFnumber, AllMockProviders);
    }
  });
  
    it("Should store prices on rebalance", async function() {
        const {yearnProviderMock, compoundProviderMock, aaveProviderMock} = AllMockProviders;
        let compoundPrice = 1;
        let aavePrice = 2;
        let yearnPrice = 3;
        await Promise.all([
          compoundProviderMock.mock.exchangeRate.returns(compoundPrice),
          aaveProviderMock.mock.exchangeRate.returns(aavePrice), 
          yearnProviderMock.mock.exchangeRate.returns(yearnPrice),
          compoundProviderMock.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
          aaveProviderMock.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
          yearnProviderMock.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
          compoundProviderMock.mock.deposit.returns(0), // to be able to use the rebalance function
          aaveProviderMock.mock.deposit.returns(0), // to be able to use the rebalance function
          yearnProviderMock.mock.deposit.returns(0), // to be able to use the rebalance function
          compoundProviderMock.mock.withdraw.returns(0), // to be able to use the rebalance function
          aaveProviderMock.mock.withdraw.returns(0), // to be able to use the rebalance function
          yearnProviderMock.mock.withdraw.returns(0), // to be able to use the rebalance function
        ]);
    
        // await setDeltaAllocations(user, vaultMock, allProtocols); 
        await Promise.all([
          compoundVault.setDeltaAllocation(vault, game, 40),
          aaveVault.setDeltaAllocation(vault, game, 60),
          yearnVault.setDeltaAllocation(vault, game, 20),
        ]);
        await vault.depositETF(gameAddr, amountUSDC);
        await rebalanceETF(vault);

        let compoundHistoricalPrice = await vault.historicalPrices(1, compoundVault.number);
        let aaveHistoricalPrice = await vault.historicalPrices(1, aaveVault.number);
        let yearnHistoricalPrice = await vault.historicalPrices(1, yearnVault.number);

        expect(compoundPrice).to.be.equal(compoundHistoricalPrice);
        expect(aavePrice).to.be.equal(aaveHistoricalPrice);
        expect(yearnPrice).to.be.equal(yearnHistoricalPrice);
      });
});
