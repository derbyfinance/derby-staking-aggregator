/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { erc20, formatUSDC, getUSDCSigner, parseUSDC } from '../helpers/helpers';
import type { Controller, ETFVaultMock } from '../../typechain-types';
import { deployController, deployETFVaultMock } from '../helpers/deploy';
import { usdc, starterProtocols as protocols } from "../helpers/addresses";
import { initController, rebalanceETF } from "../helpers/vaultHelpers";
import allProviders  from "../helpers/allProvidersClass";
import { ethers } from "hardhat";
import { vaultInfo } from "../helpers/vaultHelpers";


const amount = 200_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, ETFnumber, uScale, gasFeeLiquidity, liquidityPerc } = vaultInfo;

describe("Testing ETFVault, unit test", async () => {
  let vault: ETFVaultMock, controller: Controller, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string;

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    await Promise.all([
      initController(controller, [userAddr, vault.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, ETFnumber, allProviders);
      await protocol.resetAllocation(vault);
    }
  });

  it.only("Should deposit / withdraw and rebalance with += 200k", async function() {
    console.log('--------------depositing and rebalance with 200k ----------------');
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, 40),
      aaveVault.setDeltaAllocation(vault, user, 60),
      yearnVault.setDeltaAllocation(vault, user, 20),
    ]);

    await vault.depositETF(userAddr, amountUSDC);
    let gasUsed = await rebalanceETF(vault);
    let gasUsedUSDC = formatUSDC(gasUsed);
    let totalGasUsed = gasUsedUSDC;

    let totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    let liquidityVault = amount * liquidityPerc / 100; // 10% liq vault 

    // get balance underlying for each protocol and compare with expected balance
    // using to.be.closeTo because of the slippage from swapping USDT and DAI
    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance = (amount - liquidityVault) * (protocol.allocation / totalAllocatedTokens);

      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log({ balanceUnderlying })
      console.log({ expectedBalance })

      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 500);
    };

    let totalUnderlying = await vault.getTotalUnderlying();
    let LPBalanceUser = await vault.balanceOf(userAddr);
    let balanceVault = await IUSDc.balanceOf(vault.address);
    let expectedBalanceVault = (amount * liquidityPerc / 100) - gasUsedUSDC;

    expect(LPBalanceUser).to.be.equal(amountUSDC); // 200k
    expect(formatUSDC(balanceVault)).to.be.closeTo(expectedBalanceVault, 5); 

    console.log('--------------rebalancing after withdrawing 40k----------------');
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, -20),
      aaveVault.setDeltaAllocation(vault, user, -20),
      yearnVault.setDeltaAllocation(vault, user, 40),
    ]);

    const amountToWithdrawUSDC = 40_000
    const amountToWithdraw = parseUSDC(amountToWithdrawUSDC.toString());

    let exchangeRate = await vault.exchangeRate();
    let USDCWithdrawed = Number(formatUSDC(exchangeRate)) * amountToWithdrawUSDC
    
    await vault.withdrawETF(userAddr, amountToWithdraw);

    gasUsed = await rebalanceETF(vault);
    gasUsedUSDC = Number(formatUSDC(gasUsed));
    totalGasUsed += gasUsedUSDC;

    totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    liquidityVault = amount * liquidityPerc / 100; // 10% liq vault 

    // get balance underlying for each protocol and compare with expected balance
    // using to.be.closeTo because of the slippage from swapping USDT and DAI
    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance = (amount - liquidityVault) * (protocol.allocation / totalAllocatedTokens);

      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log({ balanceUnderlying })
      console.log({ expectedBalance })

      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 500);
    };

    totalUnderlying = await vault.getTotalUnderlying();
    LPBalanceUser = await vault.balanceOf(userAddr);
    balanceVault = await IUSDc.balanceOf(vault.address);
    expectedBalanceVault = (amount * liquidityPerc / 100) - gasUsedUSDC;

    // expect(LPBalanceUser).to.be.equal(amountUSDC.sub(amountToWithdraw)); // 200k - 40k = 160k
    // liquidity vault should be 200k - 40k = 160k * 10%
    // expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault - gasUsedUSDC, 3); 
    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    // allProtocols.forEach((_, i) => {
    //   expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 3);
    // });

    // console.log('--------------rebalancing with deposit of 60k and Yearn to 0 ----------------');
    // protocolCompound.allocation = 80; // = 100
    // protocolAave.allocation = 40; // = 80
    // protocolYearn.allocation = -60; // = 0
    // totalAllocatedTokens = 180;
    // await setDeltaAllocations(user, vault, allProtocols);

    // const amountToDepositUSDC = 60_000
    // const amountToDeposit = parseUSDC(amountToDepositUSDC.toString());

    // exchangeRate = await vault.exchangeRate();
    // let totalSupply = amount - amountToWithdrawUSDC;
    // let LPtokensReceived = (amountToDepositUSDC * totalSupply) / (totalUnderlying - gasUsedUSDC);
    
    // await vault.depositETF(userAddr, amountToDeposit);

    // gasUsed = await rebalanceETF(vault);
    // gasUsedUSDC = Number(formatUSDC(gasUsed));

    // [balances, balanceVault, LPBalanceUser] = await Promise.all([
    //   getAndLogBalances(vault, allProtocols),
    //   IUSDc.balanceOf(vault.address),
    //   vault.balanceOf(userAddr)
    // ]);

    // totalUnderlying = amount - USDCWithdrawed + amountToDepositUSDC - totalGasUsed;
    // liquidityVault = totalUnderlying * liquidityPerc / 100; // 10% liq vault 
    // underlyingProtocols = totalUnderlying - liquidityVault;
    // expectedBalances = [
    //   100 / totalAllocatedTokens * underlyingProtocols, // Compound
    //   80 / totalAllocatedTokens * underlyingProtocols, // Aave
    //   0 / totalAllocatedTokens * underlyingProtocols // Yearn
    // ];
    // totalGasUsed += gasUsedUSDC;
    
    // let exchangeRate_toNumber = Number(exchangeRate);
    // let LPBalanceUser_toNumber = Number(LPBalanceUser);
    // let balanceVault_toNumber = Number(balanceVault);
    // console.log({exchangeRate_toNumber})
    // console.log({LPBalanceUser_toNumber})
    // console.log({LPtokensReceived})
    // console.log({totalGasUsed})
    // console.log({balanceVault_toNumber})
    // console.log({expectedBalances})
    // console.log({liquidityVault}) 
    // console.log({underlyingProtocols}) 

    // expect(Number(formatUSDC(LPBalanceUser))).to.be.closeTo(amount - amountToWithdrawUSDC + LPtokensReceived, 1); // 200k - 40k + 60k
    // // liquidity vault should be 200k - 40k - gasused = 160k * 10%
    // expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault - gasUsedUSDC, 3); 
    // // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    // allProtocols.forEach((_, i) => {
    //   expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 3);
    // });

    // console.log('-------------- everything to the vault ----------------');
    // protocolCompound.allocation = -100; // = 0
    // protocolAave.allocation = -80; // = 0
    // protocolYearn.allocation = -0; // = 0
    // totalAllocatedTokens = 0;
    // await setDeltaAllocations(user, vault, allProtocols);

    // gasUsed = await rebalanceETF(vault);
    // gasUsedUSDC = Number(formatUSDC(gasUsed));

    // [balances, balanceVault, LPBalanceUser] = await Promise.all([
    //   getAndLogBalances(vault, allProtocols),
    //   IUSDc.balanceOf(vault.address),
    //   vault.balanceOf(userAddr)
    // ]);

    // totalUnderlying = amount - USDCWithdrawed + amountToDepositUSDC - totalGasUsed;
    // expectedBalances = [
    //   0, // Compound
    //   0, // Aave
    //   0 // Yearn
    // ];

    // allProtocols.forEach((_, i) => {
    //   expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 3);
    // });
    // expect(Number(formatUSDC(balanceVault))).to.be.closeTo(totalUnderlying - gasUsedUSDC, 3);
  });

  // it("Should not deposit and withdraw when hitting the marginScale", async function() {
  //   const amount = 100_000;
  //   const amountUSDC = parseUSDC(amount.toString());
  //   console.log('-------deposit 100k, but for the 3rd protocol (yearn) the margin gets hit--------');
  //   await setDeltaAllocations(user, vault, allProtocols); 

  //   await vault.connect(dao).setMarginScale(26000*uScale);

  //   await vault.depositETF(userAddr, amountUSDC);
  //   let gasUsed = await rebalanceETF(vault);
  //   let gasUsedUSDC = Number(formatUSDC(gasUsed));
  //   let totalGasUsed = gasUsedUSDC;

  //   let [balances, balanceVault] = await Promise.all([
  //     getAndLogBalances(vault, allProtocols),
  //     IUSDc.balanceOf(vault.address),
  //   ]);

  //   let expectedBalances = [
  //     30_000, // Compound
  //     45_000, // Aave
  //     0 // Yearn
  //   ]
  //   let liquidityVault = 25_000 - gasUsedUSDC; 

  //   expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault, 2); 

  //   allProtocols.forEach((_, i) => {
  //     expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 2);
  //   });

  //   console.log('--------withdraw 35k, withdrawal should always be possible also when < marginScale--------');
  //   const amountToWithdrawUSDC = 35_000;
  //   const amountToWithdraw = parseUSDC(amountToWithdrawUSDC.toString());

  //   await vault.withdrawETF(userAddr, amountToWithdraw);

  //   let exchangeRate = await vault.exchangeRate();
  //   let USDCWithdrawed = Number(formatUSDC(exchangeRate)) * amountToWithdrawUSDC;

  //   [balances, balanceVault] = await Promise.all([
  //     getAndLogBalances(vault, allProtocols),
  //     IUSDc.balanceOf(vault.address),
  //   ]);

  //   expectedBalances = [
  //     30_000 - (USDCWithdrawed - liquidityVault), // Compound // withdraw from first protocol
  //     45_000, // Aave
  //     0 // Yearn
  //   ] 

  //   expect(Number(formatUSDC(balanceVault))).to.be.closeTo(0, 2); 

  //   allProtocols.forEach((_, i) => {
  //     expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 2);
  //   });

  //   console.log('--------rebalance to 60 - 60 compound - aave, does not have any effect because margin-------');
  //   console.log('Since liquidity of the vault is 0 here, it should pull 10k from the first protocol for liq');
  //   protocolCompound.allocation = 20; // compound: 60
  //   protocolAave.allocation = 0; // aave 60
  //   protocolYearn.allocation = -20; // yearn: 0
  //   await setDeltaAllocations(user, vault, allProtocols);

  //   gasUsed = await rebalanceETF(vault);
  //   gasUsedUSDC = Number(formatUSDC(gasUsed));

  //   [balances, balanceVault] = await Promise.all([
  //     getAndLogBalances(vault, allProtocols),
  //     IUSDc.balanceOf(vault.address),
  //   ]);

  //   // liquidity is 0, so a minimum of 10k should be pulled from protocols
  //   expectedBalances = [
  //     30_000 - (USDCWithdrawed - liquidityVault) - 10_000, // Compound // 10k liq
  //     45_000, // Aave
  //     0 // Yearn
  //   ]
  //   liquidityVault = 10_000 - gasUsedUSDC;
  //   totalGasUsed += gasUsedUSDC; 

  //   // liquidity is 0, so a minimum of 10k should be pulled from protocols
  //   expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault, 2); 

  //   allProtocols.forEach((_, i) => {
  //     expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 2);
  //   });

  //   console.log('----------rebalance only has partial effect because margin-----------');
  //   protocolCompound.allocation = -55; // compound: 5
  //   protocolAave.allocation = -40; // aave 20
  //   protocolYearn.allocation = 50; // yearn: 50
  //   await setDeltaAllocations(user, vault, allProtocols);

  //   gasUsed = await rebalanceETF(vault);
  //   gasUsedUSDC = Number(formatUSDC(gasUsed));

  //   [balances, balanceVault] = await Promise.all([
  //     getAndLogBalances(vault, allProtocols),
  //     IUSDc.balanceOf(vault.address),
  //   ]);

  //   liquidityVault = 10_000 - gasUsedUSDC;
  //   expectedBalances = [
  //     353, // Compound  400 - totalGasUsed
  //     15529, // Aave  15600 - totalGasUsed
  //     38823 // Yearn  39000 - totalGasUsed
  //   ];
  //   totalGasUsed += gasUsedUSDC; 
    
  //   // liquidity is 0, so a minimum of 10k should be pulled from protocols
  //   expect(Number(formatUSDC(balanceVault))).to.be.closeTo(liquidityVault, 2); 

  //   allProtocols.forEach((_, i) => {
  //     expect(Number(formatUSDC(balances[i]))).to.be.closeTo(expectedBalances[i], 2);
  //   });
  // });
});