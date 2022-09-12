/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, getUSDCSigner, parseEther, parseUSDC } from '../helpers/helpers';
import type { Controller, GameMock, MainVaultMock, DerbyToken, XProvider, XChainControllerMock, LZEndpointMock } from '../../typechain-types';
import { deployController, deployLZEndpointMock, deployMainVaultMock, deployXChainControllerMock, deployXProvider } from '../helpers/deploy';
import { usdc } from "../helpers/addresses";
import { initController } from "../helpers/vaultHelpers";
import AllMockProviders from "../helpers/allMockProvidersClass";
import { ethers } from "hardhat";
import { vaultInfo } from "../helpers/vaultHelpers";
import { deployGameMock, deployDerbyToken } from "../helpers/deploy";

const basketNum = 0;
const chainIds = [10, 100, 1000];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amount = 100000;
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther(1E8.toString()); 
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing Game", async () => {
  let vault: MainVaultMock, controller: Controller, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, DerbyToken: DerbyToken,  game: GameMock, xChainController: XChainControllerMock, xProvider10: XProvider, xProvider100: XProvider, LZEndpoint10: LZEndpointMock, LZEndpoint100: LZEndpointMock ;

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
    game = await deployGameMock(user, nftName, nftSymbol, DerbyToken.address, controller.address, daoAddr, controller.address);
    vault = await deployMainVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, game.address, controller.address, usdc, uScale, gasFeeLiquidity);
    xChainController = await deployXChainControllerMock(dao, daoAddr, daoAddr);

    [LZEndpoint10, LZEndpoint100] = await Promise.all([
      deployLZEndpointMock(dao, 10),
      deployLZEndpointMock(dao, 100),
    ]);

    [xProvider10, xProvider100] = await Promise.all([
      deployXProvider(dao, LZEndpoint10.address, daoAddr, daoAddr, game.address, xChainController.address, 10),
      deployXProvider(dao, LZEndpoint100.address, daoAddr, daoAddr, game.address, xChainController.address, 100)
    ])

    await Promise.all([
      xProvider10.setXControllerProvider(xProvider100.address),
      xProvider10.setXControllerChainId(100),
      xProvider100.setXControllerProvider(xProvider100.address),
      xProvider100.setXControllerChainId(100),
      xProvider10.setXControllerProvider(xProvider100.address),
      xProvider100.setXControllerProvider(xProvider100.address),
      xProvider10.setGameChainId(10),
      xProvider100.setGameChainId(10),
      xProvider10.setTrustedRemote(100, xProvider100.address),
      xProvider100.setTrustedRemote(10, xProvider10.address),
      game.connect(dao).setXProvider(xProvider10.address),
    ]);

    // With MOCK Providers
    await Promise.all([
      initController(controller, [game.address, vault.address]),
      game.connect(dao).setChainIdArray([10, 100, 1000]),
      xChainController.connect(dao).setHomeXProviderAddress(xProvider100.address),
      xChainController.connect(dao).setChainIdArray(chainIds),
      controller.connect(dao).addGame(game.address),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);

    await Promise.all([
      game.connect(dao).setLatestProtocolId(10, 5),
      game.connect(dao).setLatestProtocolId(100, 5),
      game.connect(dao).setLatestProtocolId(1000, 5),
    ]);

    await Promise.all([
      LZEndpoint10.setDestLzEndpoint(xProvider100.address, LZEndpoint100.address),
      LZEndpoint100.setDestLzEndpoint(xProvider10.address, LZEndpoint10.address),
    ]);

    // for (const protocol of protocols.values()) {
    //   await protocol.addProtocolToController(controller, vaultNumber, AllMockProviders);
    // }
  });

  it("DerbyToken should have name, symbol and totalSupply set", async function() {
    expect(await DerbyToken.name()).to.be.equal(name);
    expect(await DerbyToken.symbol()).to.be.equal(symbol);
    expect(await DerbyToken.totalSupply()).to.be.equal(totalDerbySupply); 
  });

  it("game should have DerbyToken contract addresses set", async function() {
    expect(await game.derbyTokenAddress()).to.be.equal(DerbyToken.address);
  });
  
  it("Can add a vault", async function() {
    await expect(game.connect(user).addETF(vault.address)).to.be.revertedWith("Game: only DAO");
    let latestNumber = await game.latestvaultNumber();
    expect(latestNumber).to.be.equal(0);
    await game.connect(dao).addETF(vault.address);
    latestNumber = await game.latestvaultNumber();
    expect(latestNumber).to.be.equal(1);
  });

  it("Should Lock tokens, mint basket and set correct deltas", async function() {
    await game.mintNewBasket(vaultNumber); 

    const allocationArray = [ 
      [100, 0, 0, 200, 0], // 300
      [100, 0, 200, 100, 200], // 600
      [0, 100, 200, 300, 400], // 1000 
    ];
    const totalAllocations = 1900;
    await DerbyToken.increaseAllowance(game.address, totalAllocations);
    await expect(game.connect(dao).rebalanceBasket(0, allocationArray)).to.be.revertedWith('Game: Not the owner of the basket');

    const tokenBalanceBefore = await DerbyToken.balanceOf(userAddr);
    await game.rebalanceBasket(0, allocationArray);
    const tokenBalanceAfter = await DerbyToken.balanceOf(userAddr);

    expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.be.equal(1900);

    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[0])).to.be.equal(300);
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[1])).to.be.equal(600);
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[2])).to.be.equal(1000);
    expect(await game.basketTotalAllocatedTokens(0)).to.be.equal(totalAllocations);

    // looping through all of allocationArray
    allocationArray.forEach(async (chainIdArray, i) => {
      for (let j = 0; j < chainIdArray.length; j++) {
        expect(await game.basketAllocationInProtocol(vaultNumber, chainIds[i], j)).to.be.equal(chainIdArray[j]);
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
    await game.rebalanceBasket(0, allocationDeltaArray);
    const tokenBalanceAfter = await DerbyToken.balanceOf(userAddr);

    // received 1000 tokens
    expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.equal(1000);

    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[0])).to.be.equal(200);
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[1])).to.be.equal(200);
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[2])).to.be.equal(500);
    expect(await game.basketTotalAllocatedTokens(0)).to.be.equal(1900 - 1000);

    // looping through all of allocationArray
    allocationTestArray.forEach(async (chainIdArray, i) => {
      for (let j = 0; j < chainIdArray.length; j++) {
        expect(await game.basketAllocationInProtocol(vaultNumber, chainIds[i], j)).to.be.equal(chainIdArray[j]);
      }
    });
  });

  // Allocations in protocols are not resetted at this point
  it("Should push delta allocations from game to xChainController", async function() {
    await xChainController.connect(dao).resetVaultStagesTEST(vaultNumber);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);
    // chainIds = [10, 100, 1000];
    await game.pushAllocationsToController(vaultNumber);

    // checking of allocations are correctly set in xChainController
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(900);
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[0])).to.be.equal(200);
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[1])).to.be.equal(200);
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[2])).to.be.equal(500);

    // delta allocations for chain in game should be resetted
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[0])).to.be.equal(0);
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[1])).to.be.equal(0);
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[2])).to.be.equal(0);

    // checking vaultStages
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(false);
    expect(await xChainController.getAllocationState(vaultNumber)).to.be.equal(true);

    // should not be able to rebalance when game is xChainRebalancing
    await expect(game.rebalanceBasket(0, [[0,1]])).to.be.revertedWith('Game: vault is xChainRebalancing');

    // reset allocations and state for testing 
    await game.setXChainRebalanceState(vaultNumber, false);
    await game.rebalanceBasket(
    0, 
    [ 
      [0, 0, 0, -200, 0], // 200
      [-100, 0, -100, 0, 0], // 200
      [0, -100, 0, -100, -300], // 500
    ]);
  });

  it("Calculate rewards during rebalance Basket", async function() {
    let allocations = [ 
      [parseEther('200'), parseEther('0'), parseEther('0'), parseEther('200'), parseEther('0')], // 400
      [parseEther('100'), parseEther('0'), parseEther('200'), parseEther('100'), parseEther('200')], // 600
    ];
    const totalAllocations = parseEther('1000');

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      await game.mockRewards(vaultNumber, chainIds[0], [1, 1, 1, 1, 1]),
      await game.mockRewards(vaultNumber, chainIds[1], [1, 1, 1, 1, 1]),
    ]);

    await DerbyToken.increaseAllowance(game.address, totalAllocations);
    await game.rebalanceBasket(basketNum, allocations);

    // This rebalance should be skipped for the basket
    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [2_000, 1_000, 500, 100, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [4_000, 2_000, 1_000, 200, 100]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [2_000, 1_000, 500, 100, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [4_000, 2_000, 1_000, 200, 100]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [2_000, 1_000, 500, 100, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [4_000, 2_000, 1_000, 200, 100]),
    ]);

    const newAllocations = [ 
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0], 
    ];
    await game.rebalanceBasket(basketNum, newAllocations);

    
    /*
    Rewards * allocation = totalReward
    4000 * 200 = 800_000
    200 * 200 = 40_000
    8_000 * 100 = 800_000
    2_000 * 200 = 400_000
    400 * 100 = 40_000
    200 * 200 = 40_000
    total = 2_120_000
    */
    const rewards = await game.basketUnredeemedRewards(0);
    expect(rewards).to.be.equal(2_120_000); // rebalancing period not correct? CHECK
  });

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