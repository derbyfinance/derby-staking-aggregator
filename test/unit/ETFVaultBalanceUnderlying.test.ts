/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC } from '../helpers/helpers';
import type { Controller, ETFVaultMock } from '../../typechain-types';
import { deployController, deployETFVaultMock } from '../helpers/deploy';
import { allProtocols, usdc, dai, usdt } from "../helpers/addresses";
import { rebalanceETF } from "../helpers/vaultHelpers";
import { formatUnits } from "ethers/lib/utils";
import allProviders  from "../helpers/allProvidersClass";

const amount = 5_000_000;
// const amount = Math.floor(Math.random() * 1000000);
const amountUSDC = parseUSDC(amount.toString());
const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const ETFname = 'USDC_med_risk';
const ETFnumber = 0;
const decimals = 6;
const uScale = 1E6;
const liquidityPerc = 10;
const gasFeeLiquidity = 10_000 * uScale;

const getRandomAllocation = () => Math.floor(Math.random() * 100_000);

describe.only("Testing balanceUnderlying for every single protocol vault", async () => {
  let vault: ETFVaultMock, controller: Controller, dao: Signer, game: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, gameAddr: string, protocols: any;

  beforeEach(async function() {
    [dao, game] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    gameAddr = await game.getAddress();

    [USDCSigner, IUSDc, controller] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      deployController(dao, daoAddr),
    ]);

    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, gameAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    await Promise.all([
      allProviders.init(dao, controller),
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
        ETFnumber,
        allProviders.getProviderAddress(protocol.name)
      );  
    };
  });

  it("Should calc balanceUnderlying for all known protocols correctly", async function() {
    // set random allocations for all protocols
    for (const protocol of allProtocols.values()) {
      await protocol.setDeltaAllocation(vault, game, getRandomAllocation());
    };
    
    await vault.depositETF(gameAddr, amountUSDC);
    const gasUsed = await rebalanceETF(vault);
    console.log(`Gas Used $${Number(formatUSDC(gasUsed))}`);

    const totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    const liquidityVault = amount * liquidityPerc / 100; // 10% liq vault 

    // get balance underlying for each protocol and compare with expected balance
    // using to.be.closeTo because of the slippage from swapping USDT and DAI
    for (const protocol of allProtocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const allocation = await protocol.getAllocation(vault);
      let expectedBalance = (amount - liquidityVault) * (Number(allocation) / totalAllocatedTokens);
      expectedBalance = expectedBalance < 10_000 ? 0 : expectedBalance; // minimum deposit

      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log({ balanceUnderlying })
      console.log({ expectedBalance })

      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 800);
    };

    const totalUnderlying = await vault.getTotalUnderlying();
    const vaultBalance = Number(formatUSDC(await IUSDc.balanceOf(vault.address)));
    expect(Number(formatUSDC(totalUnderlying))).to.be.closeTo(amount - vaultBalance, 800);
  }); 

  it("Should calc Shares for all known protocols correctly", async function() {
    // set random allocations for all protocols
    for (const protocol of allProtocols.values()) {
      await protocol.setDeltaAllocation(vault, game, getRandomAllocation());
    };
    
    await vault.depositETF(gameAddr, amountUSDC);
    const gasUsed = await rebalanceETF(vault);
    console.log(`Gas Used $${Number(formatUSDC(gasUsed))}`);

    // Get balance of LP shares for each protocol vault
    // Compare it with calcShares with the balanceUnderlying, should match up if calculation is correct.
    for (const protocol of allProtocols.values()) {
      const balanceUnderlying = await protocol.balanceUnderlying(vault);
      const balUnderlying = Number(formatUSDC(balanceUnderlying))
      const calculaShares = formatUnits(await protocol.calcShares(vault, balanceUnderlying), protocol.decimals);
      const balanceShares = formatUnits(await protocol.balanceShares(vault, vault.address), protocol.decimals);

      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log({ balUnderlying })
      console.log({ calculaShares })
      console.log({ balanceShares })

      expect(Number(calculaShares)).to.be.closeTo(Number(balanceShares), 100)
    };
  }); 

});
