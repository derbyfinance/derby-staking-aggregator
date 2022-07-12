/* eslint-disable node/no-unsupported-features/es-syntax */
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

const ETFNumber = 0;
const chainIds = [10, 100, 1000];
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

  it.only("Should rebalance basket and set deltaAllocationChain and deltaAllocationProtocol", async function() {
    await gameMock.connect(dao).addETF(vault.address);
    await gameMock.mintNewBasket(ETFNumber);    

    const allocationArray = [ 
      [100, 0, 0, 200, 0], // 300
      [100, 0, 200, 100, 200], // 600
      [0, 100, 200, 300, 400], // 1000 
    ];
    const totalAllocations = 1900;
    await xaverToken.increaseAllowance(gameMock.address, totalAllocations);
    await gameMock.rebalanceBasket(0, allocationArray);

    expect(await gameMock.getDeltaAllocationChain(ETFNumber, chainIds[0])).to.be.equal(300);
    expect(await gameMock.getDeltaAllocationChain(ETFNumber, chainIds[1])).to.be.equal(600);
    expect(await gameMock.getDeltaAllocationChain(ETFNumber, chainIds[2])).to.be.equal(1000);

    // looping through all of allocationArray
    allocationArray.forEach(async (chainIdArray, i) => {
      for (let j = 0; j < chainIdArray.length; j++) {
        expect(await gameMock.basketAllocationInProtocol(ETFNumber, chainIds[i], j)).to.be.equal(chainIdArray[j]);
      }
    })

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

  // breaks
  it.skip("Owner of basket NFT can read out allocations", async function() {
    // minting
    // await gameMock.connect(dao).addETF(vault.address);
    // await gameMock.mintNewBasket(0);    

    // let allocations = [20, 30, 40, 50, 60];
    // let totalAllocations = 200;
    // await xaverToken.increaseAllowance(gameMock.address, totalAllocations);
    // await gameMock.rebalanceBasket(0, allocations);

    // expect(totalAllocations).to.be.equal(await gameMock.basketTotalAllocatedTokens(0));

    // allocations.map(async (alloc, i) => {
    //   expect(alloc).to.be.equal(await gameMock.basketAllocationInProtocol(0, i));
    // });
  });

  // it.skip("Can rebalance basket, adjust delta allocations and calculate rewards", async function() {
  //   let rewards = await generateUnredeemedRewards();
  //   expect(rewards).to.be.closeTo('51111108', 500000);
  // });

  // it.skip("Should be able to redeem funds via vault function", async function() {
  //   let rewards = await generateUnredeemedRewards();
  //   let userBalanceBefore = await IUSDc.balanceOf(userAddr);
  //   let vaultBalanceBefore = await IUSDc.balanceOf(vault.address);

  //   await gameMock.triggerRedeemedRewardsVault(vault.address, userAddr, rewards);

  //   let userBalanceAfter = await IUSDc.balanceOf(userAddr);
  //   let vaultBalanceAfter = await IUSDc.balanceOf(vault.address);

  //   expect(rewards).to.be.equal(userBalanceAfter.sub(userBalanceBefore));
  //   expect(rewards).to.be.equal(vaultBalanceBefore.sub(vaultBalanceAfter));
  // });

  // it.skip("Should be able to redeem funds via game", async function() {
  //   let rewards = await generateUnredeemedRewards();
  //   let unredeemedRewards = await gameMock.basketUnredeemedRewards(0);
  //   let userBalanceBefore = await IUSDc.balanceOf(userAddr);
    
  //   await gameMock.redeemRewards(0);

  //   let userBalanceAfter = await IUSDc.balanceOf(userAddr);

  //   expect(unredeemedRewards).to.be.equal(rewards);
  //   expect(rewards).to.be.equal(userBalanceAfter.sub(userBalanceBefore));

  //   let redeemedRewards = await gameMock.basketRedeemedRewards(0);
  //   unredeemedRewards = await gameMock.basketUnredeemedRewards(0);

  //   expect(unredeemedRewards).to.be.equal(0);
  //   expect(redeemedRewards).to.be.equal(rewards);
  // });   
});