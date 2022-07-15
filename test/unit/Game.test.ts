/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, getUSDCSigner, parseEther, parseUSDC } from '../helpers/helpers';
import type { Controller, GameMock, VaultMock, DerbyToken } from '../../typechain-types';
import { deployController, deployVaultMock } from '../helpers/deploy';
import { usdc, compound_usdc_01, aave_usdc_01, yearn_usdc_01, compound_dai_01, aave_usdt_01 } from "../helpers/addresses";
import { initController, rebalanceETF } from "../helpers/vaultHelpers";
import AllMockProviders from "../helpers/allMockProvidersClass";
import { ethers } from "hardhat";
import { vaultInfo } from "../helpers/vaultHelpers";
import { deployGameMock, deployDerbyToken } from "../helpers/deploy";
import { ProtocolVault } from "@testhelp/protocolVaultClass";

const ETFNumber = 0;
const chainIds = [10, 100, 1000];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amount = 100000;
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther(1E8.toString()); 
const { name, symbol, decimals, ETFname, ETFnumber, uScale, gasFeeLiquidity } = vaultInfo;

describe.only("Testing Game", async () => {
  let vault: VaultMock, controller: Controller, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, DerbyToken: DerbyToken,  gameMock: GameMock;

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

  before(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    gameMock = await deployGameMock(user, nftName, nftSymbol, DerbyToken.address, controller.address, daoAddr, controller.address);
    vault = await deployVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, gameMock.address, controller.address, usdc, uScale, gasFeeLiquidity);

    // With MOCK Providers
    await Promise.all([
      initController(controller, [gameMock.address, vault.address]),
      controller.connect(dao).addGame(gameMock.address),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);

    await Promise.all([
      gameMock.connect(dao).setLatestProtocolId(10, 5),
      gameMock.connect(dao).setLatestProtocolId(100, 5),
      gameMock.connect(dao).setLatestProtocolId(1000, 5),
    ])

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, ETFnumber, AllMockProviders);
    }
  });

  it("DerbyToken should have name, symbol and totalSupply set", async function() {
    expect(await DerbyToken.name()).to.be.equal(name);
    expect(await DerbyToken.symbol()).to.be.equal(symbol);
    expect(await DerbyToken.totalSupply()).to.be.equal(totalDerbySupply); 
  });

  it("GameMock should have DerbyToken contract addresses set", async function() {
    expect(await gameMock.derbyTokenAddress()).to.be.equal(DerbyToken.address);
  });
  
  it("Can add a vault", async function() {
    await expect(gameMock.connect(user).addETF(vault.address)).to.be.revertedWith("Game: only DAO");
    let latestNumber = await gameMock.latestvaultNumber();
    expect(latestNumber).to.be.equal(0);
    await gameMock.connect(dao).addETF(vault.address);
    latestNumber = await gameMock.latestvaultNumber();
    expect(latestNumber).to.be.equal(1);
  });

  it("Should Lock tokens, mint basket and set correct deltas", async function() {
    await gameMock.mintNewBasket(ETFNumber); 

    const allocationArray = [ 
      [100, 0, 0, 200, 0], // 300
      [100, 0, 200, 100, 200], // 600
      [0, 100, 200, 300, 400], // 1000 
    ];
    const totalAllocations = 1900;
    await DerbyToken.increaseAllowance(gameMock.address, totalAllocations);
    await expect(gameMock.connect(dao).rebalanceBasket(0, allocationArray)).to.be.revertedWith('ETFGame Not the owner of the basket');

    const tokenBalanceBefore = await DerbyToken.balanceOf(userAddr);
    await gameMock.rebalanceBasket(0, allocationArray);
    const tokenBalanceAfter = await DerbyToken.balanceOf(userAddr);

    expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.be.equal(1900);

    expect(await gameMock.getDeltaAllocationChainTEST(ETFNumber, chainIds[0])).to.be.equal(300);
    expect(await gameMock.getDeltaAllocationChainTEST(ETFNumber, chainIds[1])).to.be.equal(600);
    expect(await gameMock.getDeltaAllocationChainTEST(ETFNumber, chainIds[2])).to.be.equal(1000);
    expect(await gameMock.basketTotalAllocatedTokens(0)).to.be.equal(totalAllocations);

    // looping through all of allocationArray
    allocationArray.forEach(async (chainIdArray, i) => {
      for (let j = 0; j < chainIdArray.length; j++) {
        expect(await gameMock.basketAllocationInProtocol(ETFNumber, chainIds[i], j)).to.be.equal(chainIdArray[j]);
      }
    });
  });

  it("Should Unlock lokens and read allocations in basket", async function() {
    const allocationDeltaArray = [ 
      [-100, 0, 0, 0, 0],
      [0, 0, -100, -100, -200],
      [0, 0, -200, -200, -100],
    ];

    const allocationTestArray = [ 
      [0, 0, 0, 200, 0], // 200
      [100, 0, 100, 0, 0], // 200
      [0, 100, 0, 100, 300], // 500
    ];

    const tokenBalanceBefore = await DerbyToken.balanceOf(userAddr);    
    await gameMock.rebalanceBasket(0, allocationDeltaArray);
    const tokenBalanceAfter = await DerbyToken.balanceOf(userAddr);

    // received 1000 tokens
    expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.equal(1000);

    expect(await gameMock.getDeltaAllocationChainTEST(ETFNumber, chainIds[0])).to.be.equal(200);
    expect(await gameMock.getDeltaAllocationChainTEST(ETFNumber, chainIds[1])).to.be.equal(200);
    expect(await gameMock.getDeltaAllocationChainTEST(ETFNumber, chainIds[2])).to.be.equal(500);
    expect(await gameMock.basketTotalAllocatedTokens(0)).to.be.equal(1900 - 1000);

    // looping through all of allocationArray
    allocationTestArray.forEach(async (chainIdArray, i) => {
      for (let j = 0; j < chainIdArray.length; j++) {
        expect(await gameMock.basketAllocationInProtocol(ETFNumber, chainIds[i], j)).to.be.equal(chainIdArray[j]);
      }
    });
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