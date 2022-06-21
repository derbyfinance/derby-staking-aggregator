/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, getUSDCSigner, parseEther, parseUSDC } from '../helpers/helpers';
import type { Controller, ETFGameMock, ETFVaultMock, XaverToken } from '../../typechain-types';
import { deployController, deployETFVaultMock } from '../helpers/deploy';
import { usdc, compound_usdc_01, aave_usdc_01, yearn_usdc_01, compound_dai_01, aave_usdt_01 } from "../helpers/addresses";
import { initController, rebalanceETF } from "../helpers/vaultHelpers";
import AllMockProviders from "../helpers/allMockProvidersClass";
import { ethers } from "hardhat";
import { vaultInfo } from "../helpers/vaultHelpers";
import { deployETFGameMock, deployXaverToken } from "../helpers/deploy";
import { ProtocolVault } from "@testhelp/protocolVaultClass";


const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amount = 100000;
const amountUSDC = parseUSDC(amount.toString());
const totalXaverSupply = parseEther(1E8.toString()); 
const { name, symbol, decimals, ETFname, ETFnumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing ETFgameMock", async () => {
  let vault: ETFVaultMock, controller: Controller, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, xaverToken: XaverToken,  gameMock: ETFGameMock;

  const protocols = new Map<string, ProtocolVault>()
  .set('compound_usdc_01', compound_usdc_01)
  .set('compound_dai_01', compound_dai_01)
  .set('aave_usdc_01', aave_usdc_01)
  .set('aave_usdt_01', aave_usdt_01)
  .set('yearn_usdc_01', yearn_usdc_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const compoundDAIVault = protocols.get('compound_dai_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const aaveUSDTVault = protocols.get('aave_usdt_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  async function generateUnredeemedRewards() {
    const {yearnProvider, compoundProvider, aaveProvider} = AllMockProviders;

    // minting
    await gameMock.connect(dao).addETF(vault.address);
    await gameMock.mintNewBasket(0);

    // set liquidity vault to 0 for easy calculation 
    await vault.setLiquidityPerc(0);

    const amount = 10_000;
    const amountUSDC = parseUSDC(amount.toString());

    // set balance before
    let balance = 1000*1E6;
    let balanceComp = 1000*1E8;
    let price = 1000;
    await Promise.all([
      yearnProvider.mock.balanceUnderlying.returns(balance),
      compoundProvider.mock.balanceUnderlying.returns(balanceComp),
      aaveProvider.mock.balanceUnderlying.returns(balance),
      yearnProvider.mock.deposit.returns(0),
      compoundProvider.mock.deposit.returns(0),
      aaveProvider.mock.deposit.returns(0),
      yearnProvider.mock.withdraw.returns(0),
      compoundProvider.mock.withdraw.returns(0),
      aaveProvider.mock.withdraw.returns(0),
      yearnProvider.mock.exchangeRate.returns(price),
      compoundProvider.mock.exchangeRate.returns(price),
      aaveProvider.mock.exchangeRate.returns(price),
    ]);

    // set some initial allocations in the basket
    let allocations = [10, 0, 10, 0, 10];
    await xaverToken.increaseAllowance(gameMock.address, 30);
    await gameMock.rebalanceBasket(0, allocations);

    // do 3 loops to simulate time passing (and bump up rebalancingperiod).
    for (let i = 0; i < 3; i++){
      await Promise.all([
        compoundVault.setDeltaAllocationsWithGame(gameMock, vault.address, 40),
        aaveVault.setDeltaAllocationsWithGame(gameMock, vault.address, 60),
        yearnVault.setDeltaAllocationsWithGame(gameMock, vault.address, 20),
        compoundDAIVault.setDeltaAllocationsWithGame(gameMock, vault.address, 0),
        aaveUSDTVault.setDeltaAllocationsWithGame(gameMock, vault.address, 0),
      ]);

      // await setDeltaAllocationsWithGame(vault, gameMock, allProtocols);
      await vault.connect(user).depositETF(amountUSDC);

      // set balance after
      price = Math.round(price * 1.1);
      await Promise.all([
        yearnProvider.mock.exchangeRate.returns(price),
        compoundProvider.mock.exchangeRate.returns(price),
        aaveProvider.mock.exchangeRate.returns(price),
      ]);
      await vault.setVaultState(3);
      await rebalanceETF(vault);
    }
    
    // set new allocations in basket
    let newAllocations = [20, 0, 20, 0, 20]; // not actually stored in vault because we didn't rebalance the vault here
    await xaverToken.increaseAllowance(gameMock.address, 50);
    await gameMock.rebalanceBasket(0, newAllocations);

    // yield per time step: 0.1
    // started counting basket rewards at rebalancingPeriod 1
    // end counting basket rewards at rebalancingPeriod 3
    // 1: rewards: 0
    // 2: TVL: 10k + 10k +3k = 23k, y: 0.1, perfFee: 0.1, totalTokens: 30 + 120 + 120 = 270, allocations user per protocol: 10
    // 2: rewards = 23000 * 1E6 * 0.1 * 0.1 / 270 * 10 = 8518518 per game player, 3 players total --> 25555554
    // 3: rewards = 25555554
    // total expected rewards = 2 * 25555554 = 51111108
    let rewards = await gameMock.basketUnredeemedRewards(0);
    return rewards;
  }

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    xaverToken = await deployXaverToken(user, name, symbol, totalXaverSupply);
    gameMock = await deployETFGameMock(user, nftName, nftSymbol, xaverToken.address, controller.address, daoAddr, controller.address);
    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, gameMock.address, controller.address, usdc, uScale, gasFeeLiquidity);

    // With MOCK Providers
    await Promise.all([
      initController(controller, [gameMock.address, vault.address]),
      controller.connect(dao).addGame(gameMock.address),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, ETFnumber, AllMockProviders);
    }
  });

  it("XaverToken should have name, symbol and totalSupply set", async function() {
    expect(await xaverToken.name()).to.be.equal(name);
    expect(await xaverToken.symbol()).to.be.equal(symbol);
    expect(await xaverToken.totalSupply()).to.be.equal(totalXaverSupply); 
  });

  it("ETFgameMock should have xaverToken contract addresses set", async function() {
    expect(await gameMock.xaverTokenAddress()).to.be.equal(xaverToken.address);
  });
  
  it("Can add a vault", async function() {
    await expect(gameMock.connect(user).addETF(vault.address)).to.be.revertedWith("ETFGame: only DAO");
    let latestETFNumber = await gameMock.latestETFNumber();
    expect(latestETFNumber).to.be.equal(0);
    await gameMock.connect(dao).addETF(vault.address);
    latestETFNumber = await gameMock.latestETFNumber();
    expect(latestETFNumber).to.be.equal(1);
    expect(await gameMock.ETFVaults(0)).to.be.equal(vault.address);
  });

  it("Can mint a basket NFT and lock xaver tokens in it, can also unlock the xaver tokens", async function() {
    // minting
    await gameMock.connect(dao).addETF(vault.address);
    await gameMock.mintNewBasket(0);
    const ownerOfNFT = await gameMock.ownerOf(0);
    const userAddr = await user.getAddress();
    expect(ownerOfNFT).to.be.equal(userAddr);

    // locking
    const amountToLock = 1000;
    const balanceBefore = await xaverToken.balanceOf(userAddr);
    await xaverToken.approve(gameMock.address, amountToLock);
    await expect(gameMock.connect(dao).lockTokensToBasketTEST(0, amountToLock)).to.be.revertedWith("ETFGame Not the owner of the basket");
    await gameMock.lockTokensToBasketTEST(0, amountToLock);
    const balanceDiff = balanceBefore.sub(await xaverToken.balanceOf(userAddr));
    await expect(gameMock.connect(dao).basketTotalAllocatedTokens(0)).to.be.revertedWith("ETFGame Not the owner of the basket");
    let unAllocatedTokens = await gameMock.basketTotalAllocatedTokens(0);
    expect(unAllocatedTokens).to.be.equal(amountToLock);
    expect(balanceDiff).to.be.equal(amountToLock.toString());

    // unlocking
    await expect(gameMock.connect(dao).unlockTokensFromBasketTEST(0, amountToLock)).to.be.revertedWith("ETFGame Not the owner of the basket");
    await expect(gameMock.unlockTokensFromBasketTEST(0, amountToLock+1)).to.be.revertedWith("Not enough unallocated tokens in basket");
    await gameMock.unlockTokensFromBasketTEST(0, amountToLock);
    await expect(gameMock.connect(dao).basketTotalAllocatedTokens(0)).to.be.revertedWith("ETFGame Not the owner of the basket");
    unAllocatedTokens = await gameMock.basketTotalAllocatedTokens(0);
    expect(unAllocatedTokens).to.be.equal(0);
    expect(await xaverToken.balanceOf(userAddr)).to.be.equal(balanceBefore);
  });

  it("Owner of basket NFT can read out allocations", async function() {
    // minting
    await gameMock.connect(dao).addETF(vault.address);
    await gameMock.mintNewBasket(0);    

    let allocations = [20, 30, 40, 50, 60];
    let totalAllocations = 200;
    await xaverToken.increaseAllowance(gameMock.address, totalAllocations);
    await gameMock.rebalanceBasket(0, allocations);

    expect(totalAllocations).to.be.equal(await gameMock.basketTotalAllocatedTokens(0));

    allocations.map(async (alloc, i) => {
      expect(alloc).to.be.equal(await gameMock.basketAllocationInProtocol(0, i));
    });
  });

  it("Can rebalance basket, adjust delta allocations and calculate rewards", async function() {
    let rewards = await generateUnredeemedRewards();
    expect(rewards).to.be.closeTo('51111108', 500000);
  });

  it("Should be able to redeem funds via vault function", async function() {
    let rewards = await generateUnredeemedRewards();
    let userBalanceBefore = await IUSDc.balanceOf(userAddr);
    let vaultBalanceBefore = await IUSDc.balanceOf(vault.address);

    await gameMock.triggerRedeemedRewardsVault(vault.address, userAddr, rewards);

    let userBalanceAfter = await IUSDc.balanceOf(userAddr);
    let vaultBalanceAfter = await IUSDc.balanceOf(vault.address);

    expect(rewards).to.be.equal(userBalanceAfter.sub(userBalanceBefore));
    expect(rewards).to.be.equal(vaultBalanceBefore.sub(vaultBalanceAfter));
  });

  it("Should be able to redeem funds via game", async function() {
    let rewards = await generateUnredeemedRewards();
    let unredeemedRewards = await gameMock.basketUnredeemedRewards(0);
    let userBalanceBefore = await IUSDc.balanceOf(userAddr);
    
    await gameMock.redeemRewards(0);

    let userBalanceAfter = await IUSDc.balanceOf(userAddr);

    expect(unredeemedRewards).to.be.equal(rewards);
    expect(rewards).to.be.equal(userBalanceAfter.sub(userBalanceBefore));

    let redeemedRewards = await gameMock.basketRedeemedRewards(0);
    unredeemedRewards = await gameMock.basketUnredeemedRewards(0);

    expect(unredeemedRewards).to.be.equal(0);
    expect(redeemedRewards).to.be.equal(rewards);
  });   
});