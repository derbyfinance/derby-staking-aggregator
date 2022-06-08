/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert, use } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC, parseEther, formatUnits, parseUnits } from '../helpers/helpers';
import { setDeltaAllocationsWithGame, getAllocations, rebalanceETF } from '../helpers/vaultHelpers';
import { ETFVaultMock, XaverToken, ETFGameMock } from '../../typechain-types';
import { MockContract } from "ethereum-waffle";
import { beforeEachETFVault, Protocol } from "../helpers/vaultBeforeEach";
import { deployETFGameMock, deployXaverToken } from "../helpers/deploy";

const name = 'XaverUSDC';
const symbol = 'dUSDC';
const nftName = 'XaverNFT';
const nftSymbol = 'XAVNFT';
const decimals = 18;
const marginScale = 1E9;
const uScale = 1E6;
const liquidityPerc = 10;
const amount = 100000;
const amountUSDC = parseUSDC(amount.toString());
const totalXaverSupply = parseEther(1E8.toString()); 

describe.only("Testing ETFgameMock", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolAave: Protocol,
  protocolYearn: Protocol,
  allProtocols: Protocol[],
  controller: Contract,
  gameMock: ETFGameMock,
  xaverToken: XaverToken,
  yearnProvider: MockContract, 
  compoundProvider: MockContract, 
  aaveProvider: MockContract

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn],
      allProtocols,
      IUSDc,
      yearnProvider, 
      compoundProvider, 
      aaveProvider,,
      controller,,,,,,,
      dao,
      gameMock,
      xaverToken
    ] = await beforeEachETFVault(amountUSDC, true, true)

    const daoAddr = await dao.getAddress();
    // xaverToken = await deployXaverToken(user, name, symbol, totalXaverSupply);
    // gameMock = await deployETFgameMockMock(user, name, symbol, xaverToken.address, controller.address, daoAddr);  
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
    await expect(gameMock.connect(user).addETF(vaultMock.address)).to.be.revertedWith("ETFGame: only DAO");
    let latestETFNumber = await gameMock.latestETFNumber();
    expect(latestETFNumber).to.be.equal(0);
    await gameMock.connect(dao).addETF(vaultMock.address);
    latestETFNumber = await gameMock.latestETFNumber();
    expect(latestETFNumber).to.be.equal(1);
    expect(await gameMock.ETFVaults(0)).to.be.equal(vaultMock.address);
  });

  it("Can mint a basket NFT and lock xaver tokens in it, can also unlock the xaver tokens", async function() {
    // minting
    await gameMock.connect(dao).addETF(vaultMock.address);
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
    await gameMock.connect(dao).addETF(vaultMock.address);
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
    // minting
    await gameMock.connect(dao).addETF(vaultMock.address);
    await gameMock.mintNewBasket(0);

    // set liquidity vault to 0 for easy calculation 
    await vaultMock.setLiquidityPerc(0);

    const amount = 10_000;
    const amountUSDC = parseUSDC(amount.toString());

    // set balance before
    let balance = 1000*1E6;
    let price = 1000;
    await Promise.all([
      yearnProvider.mock.balanceUnderlying.returns(balance),
      compoundProvider.mock.balanceUnderlying.returns(balance),
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
      await setDeltaAllocationsWithGame(vaultMock, gameMock, allProtocols);
      await vaultMock.depositETF(userAddr, amountUSDC);

      // set balance after
      price = Math.round(price * 1.1);
      await Promise.all([
        yearnProvider.mock.exchangeRate.returns(price),
        compoundProvider.mock.exchangeRate.returns(price),
        aaveProvider.mock.exchangeRate.returns(price),
      ]);

      await rebalanceETF(vaultMock);
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
    expect(rewards).to.be.closeTo('51111108', 500000);
  });
});