import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import { erc20, formatUSDC, getUSDCSigner, parseUSDC } from '@testhelp/helpers';
import type { Controller, MainVaultMock } from '@typechain';
import { deployController, deployMainVaultMock } from '@testhelp/deploy';
import { usdc, starterProtocols as protocols } from '@testhelp/addresses';
import { initController, rebalanceETF } from '@testhelp/vaultHelpers';
import allProviders from '@testhelp/allProvidersClass';
import AllMockProviders from '@testhelp/allMockProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';

const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe('Testing Vault, unit test', async () => {
  let vault: MainVaultMock,
    controller: Controller,
    dao: Signer,
    game: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    gameAddr: string;

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  beforeEach(async function () {
    [dao, game] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, gameAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      game.getAddress(),
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployMainVaultMock(
      dao,
      name,
      symbol,
      decimals,
      vaultNumber,
      daoAddr,
      daoAddr,
      gameAddr,
      controller.address,
      usdc,
      uScale,
      gasFeeLiquidity,
    );

    await Promise.all([
      initController(controller, [gameAddr, vault.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(gameAddr, amountUSDC),
      IUSDc.connect(game).approve(vault.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, allProviders);
      await protocol.resetAllocation(vault);
    }
  });

  it('Should have a name and symbol', async function () {
    expect(await vault.name()).to.be.equal(name);
    expect(await vault.symbol()).to.be.equal(symbol);
    expect(await vault.decimals()).to.be.equal(decimals);
  });

  it('Should set delta allocations', async function () {
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, game, 40),
      aaveVault.setDeltaAllocation(vault, game, 60),
      yearnVault.setDeltaAllocation(vault, game, 20),
    ]);

    for (const protocol of protocols.values()) {
      console.log(protocol.name);
      const deltaAllocation = await protocol.getDeltaAllocationTEST(vault);
      expect(deltaAllocation).to.be.greaterThan(0);
      expect(deltaAllocation).to.be.equal(protocol.allocation);
    }
  });

  it('Should be able to set the marginScale, liquidityPerc and performanceFee', async function () {
    const ms = Math.floor(Math.random() * 1e10);
    await vault.connect(dao).setMarginScale(ms);

    expect(await vault.marginScale()).to.be.equal(ms);

    const lp = Math.floor(Math.random() * 100);
    await vault.connect(dao).setLiquidityPerc(lp);

    expect(await vault.liquidityPerc()).to.be.equal(lp);

    const pf = Math.floor(Math.random() * 100);
    await vault.connect(dao).setPerformanceFee(pf);

    expect(await vault.performanceFee()).to.be.equal(pf);
  });

  it('Should not be able to set the liquidityPerc or performanceFee higher than 100%', async function () {
    const lp = Math.floor(Math.random() * 100) * 1000;
    await expect(vault.connect(dao).setLiquidityPerc(lp)).to.be.revertedWith('Cannot exceed 100%');

    const pf = Math.floor(Math.random() * 100) * 1000;
    await expect(vault.connect(dao).setPerformanceFee(pf)).to.be.revertedWith('Cannot exceed 100%');
  });

  it('Should be able to blacklist protocol and pull all funds', async function () {
    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setExpectedBalance(0).setDeltaAllocation(vault, game, 40),
      aaveVault.setExpectedBalance(45_000).setDeltaAllocation(vault, game, 60),
      yearnVault.setExpectedBalance(15_000).setDeltaAllocation(vault, game, 20),
    ]);

    await vault.connect(game).deposit(amountUSDC);
    await vault.setVaultState(3);
    const gasUsed = await rebalanceETF(vault);
    let gasUsedUSDC = formatUSDC(gasUsed);

    // blacklist compound_usdc_01
    await vault.connect(dao).blacklistProtocol(compoundVault!.number);

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vault.address));
    console.log('liquidity vault after blacklisting: %s', vaultBalance);

    let expectedVaultLiquidity = 40000 - gasUsedUSDC;

    for (const protocol of protocols.values()) {
      const balance = await protocol.balanceUnderlying(vault);
      console.log(protocol.number, balance, protocol.name);
      expect(formatUSDC(balance)).to.be.closeTo(protocol.expectedBalance, 1);
    }

    expect(vaultBalance).to.be.closeTo(expectedVaultLiquidity, 1);
    expect(await controller.connect(game).getProtocolBlacklist(0, 0)).to.be.true;
  });

  it('Should not be able to set delta on blacklisted protocol', async function () {
    await controller.addVault(daoAddr); // use dao signer as vault signer
    await vault.connect(dao).blacklistProtocol(0);
    await expect(vault.connect(game).setDeltaAllocations(0, 30)).to.be.revertedWith(
      'Protocol on blacklist',
    );
  });

  it('Should not be able to rebalance in blacklisted protocol', async function () {
    await vault.setDeltaAllocationsReceivedTEST(true);
    await controller.addVault(daoAddr); // use dao signer as vault signer

    await Promise.all([
      compoundVault.setExpectedBalance(0).setDeltaAllocation(vault, game, 40),
      aaveVault.setExpectedBalance(45_000).setDeltaAllocation(vault, game, 60),
      yearnVault.setExpectedBalance(15_000).setDeltaAllocation(vault, game, 20),
    ]);

    await vault.connect(dao).blacklistProtocol(compoundVault!.number);
    await vault.connect(game).deposit(amountUSDC);

    await vault.setVaultState(3);
    const gasUsed = await rebalanceETF(vault);
    let gasUsedUSDC = formatUSDC(gasUsed);

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vault.address));
    console.log('liquidity vault after blacklisting: %s', vaultBalance);

    let expectedVaultLiquidity = 40000 - gasUsedUSDC;

    for (const protocol of protocols.values()) {
      const balance = await protocol.balanceUnderlying(vault);
      expect(formatUSDC(balance)).to.be.closeTo(protocol.expectedBalance, 1);
    }

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
    const result = await controller.connect(dao).getProtocolBlacklist(0, 0);
    expect(result).to.be.true;
  });
});

describe.skip('Testing Vault, unit test, mock providers', async () => {
  let vault: MainVaultMock,
    controller: Controller,
    dao: Signer,
    game: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    gameAddr: string;

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  beforeEach(async function () {
    [dao, game] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, gameAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      game.getAddress(),
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployMainVaultMock(
      dao,
      name,
      symbol,
      decimals,
      vaultNumber,
      daoAddr,
      daoAddr,
      gameAddr,
      controller.address,
      usdc,
      uScale,
      gasFeeLiquidity,
    );

    // With MOCK Providers
    await Promise.all([
      initController(controller, [gameAddr, vault.address]),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(gameAddr, amountUSDC),
      IUSDc.connect(game).approve(vault.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, AllMockProviders);
    }
  });

  it('Should store prices on rebalance', async function () {
    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;
    await vault.setDeltaAllocationsReceivedTEST(true);
    let compoundPrice = 1;
    let aavePrice = 2;
    let yearnPrice = 3;
    await Promise.all([
      compoundProvider.mock.exchangeRate.returns(compoundPrice),
      aaveProvider.mock.exchangeRate.returns(aavePrice),
      yearnProvider.mock.exchangeRate.returns(yearnPrice),
      compoundProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
      aaveProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
      yearnProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
      compoundProvider.mock.deposit.returns(0), // to be able to use the rebalance function
      aaveProvider.mock.deposit.returns(0), // to be able to use the rebalance function
      yearnProvider.mock.deposit.returns(0), // to be able to use the rebalance function
      compoundProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
      aaveProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
      yearnProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
    ]);
    await vault.setTotalUnderlying();

    // await setDeltaAllocations(user, vaultMock, allProtocols);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, game, 40),
      aaveVault.setDeltaAllocation(vault, game, 60),
      yearnVault.setDeltaAllocation(vault, game, 20),
    ]);
    await vault.connect(game).deposit(amountUSDC);
    await vault.setVaultState(3);
    await rebalanceETF(vault);
  });
});
