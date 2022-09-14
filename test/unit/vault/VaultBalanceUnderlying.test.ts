import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC } from '@testhelp/helpers';
import type { Controller, MainVaultMock } from '@typechain';
import { deployController, deployMainVaultMock } from '@testhelp/deploy';
import { allProtocols, usdc, dai, usdt } from "@testhelp/addresses";
import { rebalanceETF, vaultInfo } from "@testhelp/vaultHelpers";
import { formatUnits } from "ethers/lib/utils";
import allProviders  from "@testhelp/allProvidersClass";

// const amount = 5_000_000;0
const amount = Math.floor(Math.random() * 1_000_000) + 1_000_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity, liquidityPerc } = vaultInfo;

const getRandomAllocation = () => Math.floor(Math.random() * 100_000) + 100_00;

describe("Testing balanceUnderlying for every single protocol vault", async () => {
  let vault: MainVaultMock, controller: Controller, dao: Signer, game: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, gameAddr: string, protocols: any;

  beforeEach(async function() {
    [dao, game] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    gameAddr = await game.getAddress();

    [USDCSigner, IUSDc, controller] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      deployController(dao, daoAddr),
    ]);

    vault = await deployMainVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, gameAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    await Promise.all([
      allProviders.deployAllProviders(dao, controller),
      controller.addVault(gameAddr),
      controller.addVault(vault.address),
      controller.addCurveIndex(dai, 0),
      controller.addCurveIndex(usdc, 1),
      controller.addCurveIndex(usdt, 2),
      IUSDc.connect(USDCSigner).transfer(gameAddr, amountUSDC),
      IUSDc.connect(game).approve(vault.address, amountUSDC),
    ]);

    // add all protocols to controller
    for (const protocol of allProtocols.values()) {
      await protocol.addProtocolToController(
        controller,
        vaultNumber,
        allProviders
      );  
      await protocol.resetAllocation(vault);
    };
  });

  it("Should calc balanceUnderlying for all known protocols correctly", async function() {
    // set random allocations for all protocols
    for (const protocol of allProtocols.values()) {
      await protocol.setDeltaAllocation(vault, game, getRandomAllocation());
    };
    
    await vault.connect(game).deposit(amountUSDC);
    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    const gasUsed = await rebalanceETF(vault);
    const gasUsedUSDC = Number(formatUSDC(gasUsed))
    console.log(`Gas Used RebalanceETF: $${Number(formatUSDC(gasUsed))}`);

    const totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    const liquidityVault = amount * liquidityPerc / 100; // 10% liq vault 

    // get balance underlying for each protocol and compare with expected balance
    // using to.be.closeTo because of the slippage from swapping USDT and DAI
    for (const protocol of allProtocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance = (amount - liquidityVault) * (protocol.allocation / totalAllocatedTokens);

      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log({ balanceUnderlying })
      console.log({ expectedBalance })

      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 500);
    };

    const totalUnderlying = await vault.savedTotalUnderlying();
    const balanceVault = await IUSDc.balanceOf(vault.address);
    const expectedBalanceVault = (amount * liquidityPerc / 100) - gasUsedUSDC;

    expect(Number(formatUSDC(totalUnderlying))).to.be.closeTo(amount - liquidityVault, 500);
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(expectedBalanceVault, 20);
  }); 
  
  it("Should calc Shares for all known protocols correctly", async function() {
    // set random allocations for all protocols
    for (const protocol of allProtocols.values()) {
      await protocol.setDeltaAllocation(vault, game, getRandomAllocation());
    };
    
    await vault.connect(game).deposit(amountUSDC);
    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    const gasUsed = await rebalanceETF(vault);
    console.log(`Gas Used RebalanceETF: $${Number(formatUSDC(gasUsed))}`);

    // Get balance of LP shares for each protocol vault
    // Compare it with calcShares with the balanceUnderlying, should match up if calculation is correct.
    for (const protocol of allProtocols.values()) {
      const balanceUnderlying = await protocol.balanceUnderlying(vault);
      const balUnderlying = Number(formatUSDC(balanceUnderlying))
      const calculateShares = formatUnits(await protocol.calcShares(vault, balanceUnderlying), protocol.decimals);
      const balanceShares = formatUnits(await protocol.balanceShares(vault, vault.address), protocol.decimals);

      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log({ balUnderlying })
      console.log({ calculateShares })
      console.log({ balanceShares })

      expect(Number(calculateShares)).to.be.closeTo(Number(balanceShares), 100)
    };
  }); 

});