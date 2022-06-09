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
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(10)),
      IUSDc.connect(user).approve(vault.address, amountUSDC.mul(10)),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, ETFnumber, allProviders);
      await protocol.resetAllocation(vault);
    }
  });

  it("Should deposit / withdraw and rebalance with += 200k", async function() {
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

      expect(balanceUnderlying).to.be.closeTo(expectedBalance, 5);
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
    let USDCWithdrawed = formatUSDC(exchangeRate) * amountToWithdrawUSDC
    
    await vault.withdrawETF(userAddr, amountToWithdraw);

    gasUsed = await rebalanceETF(vault);
    gasUsedUSDC = formatUSDC(gasUsed);

    totalAllocatedTokens = Number(await vault.totalAllocatedTokens());

    let expectedTotalUnderlying = amount - USDCWithdrawed - totalGasUsed;
    liquidityVault = expectedTotalUnderlying * liquidityPerc / 100; // 10% liq vault 
    let underlyingProtocols = expectedTotalUnderlying - liquidityVault;

    // get balance underlying for each protocol and compare with expected balance
    // using to.be.closeTo because of the slippage from swapping USDT and DAI
    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance = (underlyingProtocols) * (protocol.allocation / totalAllocatedTokens);

      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log({ balanceUnderlying })
      console.log({ expectedBalance })

      expect(balanceUnderlying).to.be.closeTo(expectedBalance, 5);
    };

    LPBalanceUser = await vault.balanceOf(userAddr);
    balanceVault = await IUSDc.balanceOf(vault.address);
    totalGasUsed += gasUsedUSDC;

    expect(formatUSDC(LPBalanceUser)).to.be.equal(amount - amountToWithdrawUSDC); // 200k - 40k = 160k
    // liquidity vault should be 200k - 40k = 160k * 10%
    expect(formatUSDC(balanceVault)).to.be.closeTo(liquidityVault - gasUsedUSDC, 3); 

    console.log('--------------rebalancing with deposit of 60k and Yearn to 0 ----------------');
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, 80),
      aaveVault.setDeltaAllocation(vault, user, 40),
      yearnVault.setDeltaAllocation(vault, user, -60),
    ]);

    const amountToDepositUSDC = 60_000
    const amountToDeposit = parseUSDC(amountToDepositUSDC.toString());

    exchangeRate = await vault.exchangeRate();
    let totalSupply = amount - amountToWithdrawUSDC;
    let LPtokensReceived = (amountToDepositUSDC * totalSupply) / (expectedTotalUnderlying - gasUsedUSDC);
    
    await vault.depositETF(userAddr, amountToDeposit);

    gasUsed = await rebalanceETF(vault);
    gasUsedUSDC = formatUSDC(gasUsed);

    totalAllocatedTokens = Number(await vault.totalAllocatedTokens());

    expectedTotalUnderlying = amount - USDCWithdrawed + amountToDepositUSDC - totalGasUsed;
    liquidityVault = expectedTotalUnderlying * liquidityPerc / 100; // 10% liq vault 
    underlyingProtocols = expectedTotalUnderlying - liquidityVault;

    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance = (underlyingProtocols) * (protocol.allocation / totalAllocatedTokens);

      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log({ balanceUnderlying })
      console.log({ expectedBalance })

      expect(balanceUnderlying).to.be.closeTo(expectedBalance, 5);
    };

    totalGasUsed += gasUsedUSDC;
    LPBalanceUser = await vault.balanceOf(userAddr);
    balanceVault = await IUSDc.balanceOf(vault.address);
    
    expect(formatUSDC(LPBalanceUser)).to.be.closeTo(amount - amountToWithdrawUSDC + LPtokensReceived, 1); // 200k - 40k + 60k
    // liquidity vault should be 200k - 40k - gasused = 160k * 10%
    expect(formatUSDC(balanceVault)).to.be.closeTo(liquidityVault - gasUsedUSDC, 5); 
    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited

    console.log('-------------- everything to the vault ----------------');
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, -100),
      aaveVault.setDeltaAllocation(vault, user, -80),
      yearnVault.setDeltaAllocation(vault, user, 0),
    ]);
    
    gasUsed = await rebalanceETF(vault);
    gasUsedUSDC = formatUSDC(gasUsed);
    expectedTotalUnderlying = amount - USDCWithdrawed + amountToDepositUSDC - totalGasUsed;
    balanceVault = await IUSDc.balanceOf(vault.address);

    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance = 0;
      
      expect(balanceUnderlying).to.be.closeTo(expectedBalance, 5);
    };

    expect(formatUSDC(balanceVault)).to.be.closeTo(expectedTotalUnderlying - gasUsedUSDC, 10);
  });

  it("Should not deposit and withdraw when hitting the marginScale", async function() {
    const amount = 100_000;
    const amountUSDC = parseUSDC(amount.toString());
    console.log('-------deposit 100k, but for the 3rd protocol (yearn) the margin gets hit--------');
    await Promise.all([
      compoundVault
        .setExpectedBalance(30_000)
        .setDeltaAllocation(vault, user, 40),
      aaveVault
        .setExpectedBalance(45_000)
        .setDeltaAllocation(vault, user, 60),
      yearnVault
        .setExpectedBalance(0)
        .setDeltaAllocation(vault, user, 20),
    ]);

    await vault.connect(dao).setMarginScale(26000*uScale);

    await vault.depositETF(userAddr, amountUSDC);
    let gasUsed = await rebalanceETF(vault);
    let gasUsedUSDC = formatUSDC(gasUsed);
    let totalGasUsed = gasUsedUSDC;

    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));

      expect(balanceUnderlying).to.be.closeTo(protocol.expectedBalance, 5);
    };

    let liquidityVault = 25_000 - gasUsedUSDC; 
    let balanceVault = await IUSDc.balanceOf(vault.address);

    expect(formatUSDC(balanceVault)).to.be.closeTo(liquidityVault, 2); 


    console.log('--------withdraw 35k, withdrawal should always be possible also when < marginScale--------');
    const amountToWithdrawUSDC = 35_000;
    const amountToWithdraw = parseUSDC(amountToWithdrawUSDC.toString());

    await vault.withdrawETF(userAddr, amountToWithdraw);
    
    let exchangeRate = await vault.exchangeRate();
    let USDCWithdrawed = formatUSDC(exchangeRate) * amountToWithdrawUSDC;
    
    compoundVault.setExpectedBalance(30_000 - (USDCWithdrawed - liquidityVault));

    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      expect(balanceUnderlying).to.be.closeTo(protocol.expectedBalance, 5);
    };


    balanceVault = await IUSDc.balanceOf(vault.address);
    expect(formatUSDC(balanceVault)).to.be.closeTo(0, 2); 


    console.log('--------rebalance to 60 - 60 compound - aave, does not have any effect because margin-------');
    console.log('Since liquidity of the vault is 0 here, it should pull 10k from the first protocol for liq');

    // liquidity is 0, so a minimum of 10k should be pulled from protocols
    await Promise.all([
      compoundVault
        .setExpectedBalance(30_000 - (USDCWithdrawed - liquidityVault) - 10_000)
        .setDeltaAllocation(vault, user, 20),
      aaveVault
        .setExpectedBalance(45_000)
        .setDeltaAllocation(vault, user, 0),
      yearnVault
        .setExpectedBalance(0)
        .setDeltaAllocation(vault, user, -20),
    ]);

    gasUsed = await rebalanceETF(vault);
    gasUsedUSDC = formatUSDC(gasUsed);

    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      expect(balanceUnderlying).to.be.closeTo(protocol.expectedBalance, 5);
    };
    
    liquidityVault = 10_000 - gasUsedUSDC;
    balanceVault = await IUSDc.balanceOf(vault.address);
    totalGasUsed += gasUsedUSDC; 

    // liquidity is 0, so a minimum of 10k should be pulled from protocols
    expect(formatUSDC(balanceVault)).to.be.closeTo(liquidityVault, 2); 


    console.log('----------rebalance only has partial effect because margin-----------');
    await Promise.all([
      compoundVault
        .setExpectedBalance(374) // Compound  400 - totalGasUsed
        .setDeltaAllocation(vault, user, -55),
      aaveVault
        .setExpectedBalance(15_562) // Aave  15600 - totalGasUsed
        .setDeltaAllocation(vault, user, -40),
      yearnVault
        .setExpectedBalance(38_905) // Yearn  39000 - totalGasUsed
        .setDeltaAllocation(vault, user, 50),
    ]);

    gasUsed = await rebalanceETF(vault);
    gasUsedUSDC = formatUSDC(gasUsed);

    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log({ balanceUnderlying })
      console.log(protocol.expectedBalance)
      expect(balanceUnderlying).to.be.closeTo(protocol.expectedBalance, 5);
    };

    liquidityVault = 10_000 - gasUsedUSDC;
    balanceVault = await IUSDc.balanceOf(vault.address);
    totalGasUsed += gasUsedUSDC; 

    console.log({gasUsedUSDC})
    console.log({totalGasUsed})
    
    // liquidity is 0, so a minimum of 10k should be pulled from protocols
    expect(formatUSDC(balanceVault)).to.be.closeTo(liquidityVault, 2); 
  });
});