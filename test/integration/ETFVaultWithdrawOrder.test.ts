/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { formatUSDC, parseUSDC } from '../helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock } from '../../typechain-types';
import { rebalanceETF, setDeltaAllocations } from "../helpers/vaultHelpers";
import {  yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc} from "../helpers/addresses";
import { beforeEachETFVault, Protocol } from "../helpers/vaultBeforeEach";

const amountUSDC = parseUSDC('100000');

describe.skip("Testing ETFVaultWithdrawOrder", async () => {
  let yearnProvider: YearnProvider, 
  compoundProvider: CompoundProvider, 
  aaveProvider: AaveProvider, 
  vaultMock: ETFVaultMock,
  user: Signer,
  userAddr: string,
  IUSDc: Contract, 
  allProtocols: Protocol[];

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      ,
      allProtocols,
      IUSDc,,,,,,,,,
      yearnProvider,
      compoundProvider,
      aaveProvider
    ] = await beforeEachETFVault(amountUSDC)
  });

  it("Should deposit and withdraw in order from protocols", async function() {
    await setDeltaAllocations(user, vaultMock, allProtocols);

    console.log('---------Deposit and rebalance with 100k----------');
    await vaultMock.depositETF(userAddr, amountUSDC);
    const gasUsed = Number(formatUSDC(await rebalanceETF(vaultMock)));
    const vaultLiquidity = 10_000
    const uScale = 1E6;

    // LP Balance User == 100k
    expect(Number(formatUSDC(await vaultMock.balanceOf(userAddr)))).to.be.closeTo(100_000 , 2);
    // TotalUnderlying == 100k
    let totalUnderlying = (await vaultMock.getTotalUnderlying()).add(await IUSDc.balanceOf(vaultMock.address));
    expect(Number(formatUSDC(totalUnderlying))).to.be.closeTo(100_000 - gasUsed, 2);
    // Total liquid funds in vault == 10k
    let totalLiquidFunds = await IUSDc.balanceOf(vaultMock.address);
    expect(Number(formatUSDC(totalLiquidFunds))).to.be.closeTo(10_000 - gasUsed, 2);
    // Total supply LP tokens == 100k
    expect(Number(formatUSDC(await vaultMock.totalSupply()))).to.be.equal(100_000);
    // Total Yearn
    let totalYearn = await yearnProvider.balanceUnderlying(vaultMock.address, yusdc);
    expect(Number(formatUSDC(totalYearn))).to.be.closeTo(15_000, 2);
    // Total Compound
    let totalCompound = await compoundProvider.balanceUnderlying(vaultMock.address, cusdc);
    expect(Number(formatUSDC(totalCompound))).to.be.closeTo(30_000, 2);   
    // Total Aave
    let totalAave = await aaveProvider.balanceUnderlying(vaultMock.address, ausdc);
    expect(Number(formatUSDC(totalAave))).to.be.closeTo(45_000, 2);

    console.log('---------Withdraw 20k----------');
    await vaultMock.withdrawETF(userAddr, parseUSDC('20000'));
    let exchangeRate = await vaultMock.exchangeRate();
    let tokensWithdrawed =  parseUSDC('20000').mul(exchangeRate).div(uScale)
    let expectedTotalUnderlying = amountUSDC.sub(tokensWithdrawed).toNumber() / uScale;
    
    // LP Balance user == 100k - 20k = 80k
    expect(Number(formatUSDC(await vaultMock.balanceOf(userAddr)))).to.be.closeTo(80_000, 2);
    // TotalUnderlying == 100k -20k = 80k
    totalUnderlying = await vaultMock.getTotalUnderlying();
    expect(Number(formatUSDC(totalUnderlying))).to.be.closeTo(expectedTotalUnderlying - gasUsed, 2);
    // Total liquid funds in vault == 0k
    totalLiquidFunds = await IUSDc.balanceOf(vaultMock.address);
    expect(Number(formatUSDC(totalLiquidFunds))).to.be.closeTo(0, 2); 
    // Total supply LP tokens == 80k
    expect(Number(formatUSDC(await vaultMock.totalSupply()))).to.be.equal(80_000);
    // Total Compound 1/3 x 90k - 10k withdraw
    totalCompound = await compoundProvider.balanceUnderlying(vaultMock.address, cusdc);
    let amountWithdrawed = Number(formatUSDC(tokensWithdrawed))
    expect(Number(formatUSDC(totalCompound))).to.be.closeTo(
      30_000 - (amountWithdrawed - vaultLiquidity) - gasUsed, 2
        );   
    // Total Aave
    totalAave = await aaveProvider.balanceUnderlying(vaultMock.address, ausdc);
    expect(Number(formatUSDC(totalAave))).to.be.closeTo(45_000, 2);
    // Total Yearn
    totalYearn = await yearnProvider.balanceUnderlying(vaultMock.address, yusdc);
    expect(Number(formatUSDC(totalYearn))).to.be.closeTo(15_000, 2);

    console.log('---------Withdraw 60k----------');
    await vaultMock.withdrawETF(userAddr, parseUSDC('60000'));
    exchangeRate = await vaultMock.exchangeRate();
    tokensWithdrawed =  parseUSDC('80000').mul(exchangeRate).div(uScale)
    expectedTotalUnderlying = amountUSDC.sub(tokensWithdrawed).toNumber() / uScale;

    // LP Balance user == 100k - 20k - 60k = 20k
    expect(Number(formatUSDC(await vaultMock.balanceOf(userAddr)))).to.be.closeTo(20_000, 2);
    // TotalUnderlying == 100k -20k -60k = 20k
    totalUnderlying = await vaultMock.getTotalUnderlying();
    amountWithdrawed = Number(formatUSDC(tokensWithdrawed))
    expect(Number(formatUSDC(totalUnderlying))).to.be.closeTo(
      100_000 - amountWithdrawed - gasUsed, 2
    );
    // Total liquid funds in vault == 0k
    totalLiquidFunds = await IUSDc.balanceOf(vaultMock.address);
    expect(Number(formatUSDC(totalLiquidFunds))).to.be.closeTo(0, 2); 
    // Total supply LP tokens == 20k
    expect(Number(formatUSDC(await vaultMock.totalSupply()))).to.be.equal(20_000);
    // Total Compound
    totalCompound = await compoundProvider.balanceUnderlying(vaultMock.address, cusdc);
    expect(Number(formatUSDC(totalCompound))).to.be.closeTo(0, 2);   
    // Total Aave // 15k from yearn vault
    totalAave = await aaveProvider.balanceUnderlying(vaultMock.address, ausdc);
    expect(Number(formatUSDC(totalAave))).to.be.closeTo(100_000 - amountWithdrawed - gasUsed - 15_000, 2);
    // Total Yearn
    totalYearn = await yearnProvider.balanceUnderlying(vaultMock.address, yusdc);
    expect(Number(formatUSDC(totalYearn))).to.be.closeTo(15_000, 2);

    console.log('---------Withdraw 60k = more than balance----------');
    // Should be reverted
    await expect(vaultMock.withdrawETF(userAddr, parseUSDC('60000'))).to.be.reverted;
  });
  

});

