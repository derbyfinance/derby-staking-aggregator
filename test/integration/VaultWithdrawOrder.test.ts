import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, formatUSDC, getUSDCSigner, parseUSDC } from '@testhelp/helpers';
import type { Controller, MainVaultMock } from '@typechain';
import { deployController, deployMainVaultMock } from '@testhelp/deploy';
import { usdc, starterProtocols as protocols } from "@testhelp/addresses";
import { initController, rebalanceETF } from "@testhelp/vaultHelpers";
import allProviders  from "@testhelp/allProvidersClass";
import { ethers } from "hardhat";
import { vaultInfo } from "@testhelp/vaultHelpers";


const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe.skip("Testing VaultWithdrawOrder, integration test", async () => {
  let vault: MainVaultMock, controller: Controller, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string;

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
    vault = await deployMainVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    await Promise.all([
      initController(controller, [userAddr, vault.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(10)),
      IUSDc.connect(user).approve(vault.address, amountUSDC.mul(10)),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, allProviders);
      await protocol.resetAllocation(vault);
    }
  });

  it("Should deposit and withdraw in order from protocols", async function() {
    const { yearnProvider, compoundProvider, aaveProvider } = allProviders;

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, 40),
      aaveVault.setDeltaAllocation(vault, user, 60),
      yearnVault.setDeltaAllocation(vault, user, 20),
    ]);

    console.log('---------Deposit and rebalance with 100k----------');
    await vault.connect(user).deposit(amountUSDC);
    const gasUsed = formatUSDC(await rebalanceETF(vault));
    const vaultLiquidity = 10_000

    // LP Balance User == 100k
    expect(formatUSDC(await vault.balanceOf(userAddr))).to.be.closeTo(100_000 , 2);
    // TotalUnderlying == 100k
    let totalUnderlying = (await vault.savedTotalUnderlying()).add(await IUSDc.balanceOf(vault.address));
    expect(formatUSDC(totalUnderlying)).to.be.closeTo(100_000 - gasUsed, 2);
    // Total liquid funds in vault == 10k
    let totalLiquidFunds = await IUSDc.balanceOf(vault.address);
    expect(formatUSDC(totalLiquidFunds)).to.be.closeTo(10_000 - gasUsed, 2);
    // Total supply LP tokens == 100k
    expect(formatUSDC(await vault.totalSupply())).to.be.equal(100_000);
    // Total Yearn
    let totalYearn = await yearnProvider.balanceUnderlying(vault.address, yearnVault.protocolToken);
    expect(formatUSDC(totalYearn)).to.be.closeTo(15_000, 2);
    // Total Compound
    let totalCompound = await compoundProvider.balanceUnderlying(vault.address, compoundVault.protocolToken);
    expect(formatUSDC(totalCompound) * uScale / compoundVault.scale).to.be.closeTo(30_000, 2);   
    // Total Aave
    let totalAave = await aaveProvider.balanceUnderlying(vault.address, aaveVault.protocolToken);
    expect(formatUSDC(totalAave)).to.be.closeTo(45_000, 2);

    console.log('---------Withdraw 20k----------');
    await vault.connect(user).withdraw(parseUSDC('20000'));
    let exchangeRate = await vault.exchangeRate();
    let tokensWithdrawed =  parseUSDC('20000').mul(exchangeRate).div(uScale)
    let expectedTotalUnderlying = amountUSDC.sub(tokensWithdrawed).toNumber() / uScale;
    
    // LP Balance user == 100k - 20k = 80k
    expect(formatUSDC(await vault.balanceOf(userAddr))).to.be.closeTo(80_000, 2);
    // TotalUnderlying == 100k -20k = 80k
    totalUnderlying = await vault.savedTotalUnderlying();
    expect(formatUSDC(totalUnderlying)).to.be.closeTo(expectedTotalUnderlying - gasUsed, 2);
    // Total liquid funds in vault == 0k
    totalLiquidFunds = await IUSDc.balanceOf(vault.address);
    expect(formatUSDC(totalLiquidFunds)).to.be.closeTo(0, 2); 
    // Total supply LP tokens == 80k
    expect(formatUSDC(await vault.totalSupply())).to.be.equal(80_000);
    // Total Compound 1/3 x 90k - 10k withdraw
    totalCompound = await compoundProvider.balanceUnderlying(vault.address, compoundVault.protocolToken);
    let amountWithdrawed = formatUSDC(tokensWithdrawed)
    expect(formatUSDC(totalCompound) * uScale / compoundVault.scale).to.be.closeTo(
      30_000 - (amountWithdrawed - vaultLiquidity) - gasUsed, 2
        );   
    // Total Aave
    totalAave = await aaveProvider.balanceUnderlying(vault.address, aaveVault.protocolToken);
    expect(formatUSDC(totalAave)).to.be.closeTo(45_000, 2);
    // Total Yearn
    totalYearn = await yearnProvider.balanceUnderlying(vault.address, yearnVault.protocolToken);
    expect(formatUSDC(totalYearn)).to.be.closeTo(15_000, 2);

    console.log('---------Withdraw 60k----------');
    await vault.connect(user).withdraw(parseUSDC('60000'));
    exchangeRate = await vault.exchangeRate();
    tokensWithdrawed =  parseUSDC('80000').mul(exchangeRate).div(uScale)
    expectedTotalUnderlying = amountUSDC.sub(tokensWithdrawed).toNumber() / uScale;

    // LP Balance user == 100k - 20k - 60k = 20k
    expect(formatUSDC(await vault.balanceOf(userAddr))).to.be.closeTo(20_000, 2);
    // TotalUnderlying == 100k -20k -60k = 20k
    totalUnderlying = await vault.savedTotalUnderlying();
    amountWithdrawed = formatUSDC(tokensWithdrawed)
    expect(formatUSDC(totalUnderlying)).to.be.closeTo(
      100_000 - amountWithdrawed - gasUsed, 2
    );
    // Total liquid funds in vault == 0k
    totalLiquidFunds = await IUSDc.balanceOf(vault.address);
    expect(formatUSDC(totalLiquidFunds)).to.be.closeTo(0, 2); 
    // Total supply LP tokens == 20k
    expect(formatUSDC(await vault.totalSupply())).to.be.equal(20_000);
    // Total Compound
    totalCompound = await compoundProvider.balanceUnderlying(vault.address, compoundVault.protocolToken);
    expect(formatUSDC(totalCompound) * uScale / compoundVault.scale).to.be.closeTo(0, 2);   
    // Total Aave // 15k from yearn vault
    totalAave = await aaveProvider.balanceUnderlying(vault.address, aaveVault.protocolToken);
    expect(formatUSDC(totalAave)).to.be.closeTo(100_000 - amountWithdrawed - gasUsed - 15_000, 2);
    // Total Yearn
    totalYearn = await yearnProvider.balanceUnderlying(vault.address, yearnVault.protocolToken);
    expect(formatUSDC(totalYearn)).to.be.closeTo(15_000, 2);

    console.log('---------Withdraw 60k = more than balance----------');
    // Should be reverted
    await expect(vault.connect(user).withdraw(parseUSDC('60000'))).to.be.reverted;
  });
  

});

