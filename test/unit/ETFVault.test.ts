/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { erc20, formatUSDC, getUSDCSigner, parseUSDC } from '../helpers/helpers';
import type { Controller, ETFVaultMock } from '../../typechain-types';
import { deployController, deployETFVaultMock } from '../helpers/deploy';
import { usdc, yearn_usdc_01, compound_usdc_01, aave_usdc_01 } from "../helpers/addresses";
import { addAllProtocolsToController, initController, rebalanceETF } from "../helpers/vaultHelpers";
import allProviders  from "../helpers/allProvidersClass";
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
  // let vaultMock: ETFVaultMock,
  // user: Signer,
  // dao: Signer,
  // userAddr: string,
  // IUSDc: Contract, 
  // protocolCompound: Protocol,
  // protocolAave: Protocol,
  // protocolYearn: Protocol,
  // allProtocols: Protocol[],
  // controller: Contract,
  // yearnProvider: MockContract, 
  // compoundProvider: MockContract, 
  // aaveProvider: MockContract;

  // beforeEach(async function() {
  //   [
  //     vaultMock,
  //     user,
  //     userAddr,
  //     [protocolCompound, protocolAave, protocolYearn],
  //     allProtocols,
  //     IUSDc,
  //     yearnProvider, 
  //     compoundProvider, 
  //     aaveProvider,,
  //     controller,,,,,,,
  //     dao
  //   ] = await beforeEachETFVault(amountUSDC)
  // });
  let vault: ETFVaultMock, controller: Controller, dao: Signer, game: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, gameAddr: string;
  const protocols = new Map<string, ProtocolVault>()
  .set('yearn_usdc_01', yearn_usdc_01)
  .set('compound_usdc_01', compound_usdc_01)
  .set('aave_usdc_01', aave_usdc_01);

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
      protocols.get("yearn_usdc_01")?.setDeltaAllocation(vault, game, 20),
      protocols.get("compound_usdc_01")?.setDeltaAllocation(vault, game, 40),
      protocols.get("aave_usdc_01")?.setDeltaAllocation(vault, game, 60),
    ]);

    for (const protocol of protocols.values()) {
      const deltaAllocation = await protocol.getDeltaAllocationTEST(vault);
      console.log({deltaAllocation})
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

  it.only("Should be able to blacklist protocol and pull all funds", async function() {
    await Promise.all([
      protocols.get("compound_usdc_01")!
        .setExpectedBalance(0)
        .setDeltaAllocation(vault, game, 40),
      protocols.get("aave_usdc_01")!
        .setExpectedBalance(45_000)
        .setDeltaAllocation(vault, game, 60),
      protocols.get("yearn_usdc_01")!
        .setExpectedBalance(15_000)
        .setDeltaAllocation(vault, game, 20),
    ]);
    
    await vault.depositETF(gameAddr, amountUSDC);
    const gasUsed = await rebalanceETF(vault);
    let gasUsedUSDC = formatUSDC(gasUsed);

    await vault.connect(dao).blacklistProtocol(0);

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vault.address));
    console.log("liquidity vault after blacklisting: %s", vaultBalance);

    let expectedVaultLiquidity = 40000 - gasUsedUSDC;

    protocols.forEach(async (protocol, i, j) => {
      const balance = await protocol.balanceUnderlying(vault);
      console.log({balance})
      expect(formatUSDC(balance)).to.be.closeTo(protocol.expectedBalance, 1)
    });

    // expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
    
    // expect(await controller.connect(dao).getProtocolBlacklist(0, 0)).to.be.true;
  });

//   it("Should not be able to set delta on blacklisted protocol", async function() {
//     await controller.addVault(dao.getAddress()); // use dao signer as vault signer
//     await vault.connect(dao).blacklistProtocol(0);
//     await expect(vault.connect(user).setDeltaAllocations(0, 30))
//     .to.be.revertedWith('Protocol on blacklist');
//   });

//   it("Should not be able to rebalance in blacklisted protocol", async function() {
//     await controller.addVault(dao.getAddress()); // use dao signer as vault signer
//     await setDeltaAllocations(user, vault, allProtocols);
//     await vault.connect(dao).blacklistProtocol(0);
//     await vault.depositETF(userAddr, amountUSDC);
//     const gasUsed = await rebalanceETF(vault);
//     let gasUsedUSDC = Number(formatUSDC(gasUsed));

//     let vaultBalance = formatUSDC(await IUSDc.balanceOf(vault.address));
//     console.log("liquidity vault after blacklisting: %s", vaultBalance);
//     let balances = await getAndLogBalances(vault, allProtocols);
//     let expectedBalances = [0, 45000, 15000];
//     let expectedVaultLiquidity = 40000 - gasUsedUSDC;

//     allProtocols.forEach((protocol, i) => {
//       expect(Number(balances[i].div(uScale))).to.be.closeTo(expectedBalances[i], 2)
//     });

//     expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
//     const result = await controller.connect(dao).getProtocolBlacklist(0, 0);
//     expect(result).to.be.true;
//   });
// });

// describe("Testing ETFVault, unit test, mock providers", async () => {
//     let yearnProvider: MockContract, 
//     compoundProvider: MockContract, 
//     aaveProvider: MockContract, 
//     vaultMock: ETFVaultMock,
//     userAddr: string,
//     IUSDc: Contract,
//     user: Signer,
//     allProtocols: Protocol[];
  
//     beforeEach(async function() {
//       [
//         vaultMock,
//         user,
//         userAddr,
//         ,
//         allProtocols,
//         IUSDc,
//         yearnProvider, 
//         compoundProvider, 
//         aaveProvider
//       ] = await beforeEachETFVault(amountUSDC, true);
//     });
  
//     it("Should store prices on rebalance", async function() {
//         let compoundPrice = 1;
//         let aavePrice = 2;
//         let yearnPrice = 3;
//         await Promise.all([
//           yearnProvider.mock.exchangeRate.returns(yearnPrice),
//           compoundProvider.mock.exchangeRate.returns(compoundPrice),
//           aaveProvider.mock.exchangeRate.returns(aavePrice), 
//           yearnProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
//           compoundProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
//           aaveProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
//           yearnProvider.mock.deposit.returns(0), // to be able to use the rebalance function
//           compoundProvider.mock.deposit.returns(0), // to be able to use the rebalance function
//           aaveProvider.mock.deposit.returns(0), // to be able to use the rebalance function
//           yearnProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
//           compoundProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
//           aaveProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
//         ]);
    
//         await setDeltaAllocations(user, vaultMock, allProtocols); 
//         await vaultMock.depositETF(userAddr, amountUSDC);
//         await rebalanceETF(vaultMock);

//         let compoundHistoricalPrice = await vaultMock.historicalPrices(1, 0);
//         let aaveHistoricalPrice = await vaultMock.historicalPrices(1, 2);
//         let yearnHistoricalPrice = await vaultMock.historicalPrices(1, 4);
//         expect(compoundPrice).to.be.equal(compoundHistoricalPrice);
//         expect(aavePrice).to.be.equal(aaveHistoricalPrice);
//         expect(yearnPrice).to.be.equal(yearnHistoricalPrice);
//       });
});
