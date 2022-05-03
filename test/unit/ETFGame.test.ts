/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert, use } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC, parseEther } from '../helpers/helpers';
import { setDeltaAllocations, getAllocations, rebalanceETF } from '../helpers/vaultHelpers';
import { ETFVaultMock, ETFGame, XaverToken, ETFGameMock } from '../../typechain-types';
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

describe.only("Testing ETFGame", async () => {
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
  game: ETFGameMock,
  xaverToken: XaverToken

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn],
      allProtocols,
      IUSDc,,,,,
      controller,,,,,,,
      dao
    ] = await beforeEachETFVault(amountUSDC)

    const daoAddr = await dao.getAddress();
    xaverToken = await deployXaverToken(user, name, symbol, totalXaverSupply);
    game = await deployETFGameMock(user, name, symbol, xaverToken.address, controller.address, daoAddr);  
  });

  it("XaverToken should have name, symbol and totalSupply set", async function() {
    expect(await xaverToken.name()).to.be.equal(name);
    expect(await xaverToken.symbol()).to.be.equal(symbol);
    expect(await xaverToken.totalSupply()).to.be.equal(totalXaverSupply); 
  });

  it("ETFGame should have xaverToken contract addresses set", async function() {
    expect(await game.xaverTokenAddress()).to.be.equal(xaverToken.address);
  });
  
  it("Can add a vault", async function() {
    await expect(game.addETF(vaultMock.address)).to.be.revertedWith("ETFGame: only DAO");
    let latestETFNumber = await game.latestETFNumber();
    expect(latestETFNumber).to.be.equal(0);
    await game.connect(dao).addETF(vaultMock.address);
    latestETFNumber = await game.latestETFNumber();
    expect(latestETFNumber).to.be.equal(1);
    expect(await game.ETFVaults(0)).to.be.equal(vaultMock.address);
  });

  it("Can mint a basket NFT and lock xaver tokens in it, can also unlock the xaver tokens", async function() {
    // minting
    await game.connect(dao).addETF(vaultMock.address);
    await game.mintNewBasket(0);
    const ownerOfNFT = await game.ownerOf(0);
    const userAddr = await user.getAddress();
    expect(ownerOfNFT).to.be.equal(userAddr);

    // locking
    const amountToLock = 1000;
    const balanceBefore = await xaverToken.balanceOf(userAddr);
    await xaverToken.approve(game.address, amountToLock),
    await expect(game.connect(dao).lockTokensToBasketTEST(userAddr, 0, amountToLock)).to.be.revertedWith("ETFGame Not the owner of the basket");
    await game.lockTokensToBasketTEST(userAddr, 0, amountToLock);
    const balanceDiff = balanceBefore.sub(await xaverToken.balanceOf(userAddr));
    await expect(game.connect(dao).basketTotalAllocatedTokens(0)).to.be.revertedWith("ETFGame Not the owner of the basket");
    let unAllocatedTokens = await game.basketTotalAllocatedTokens(0);
    expect(unAllocatedTokens).to.be.equal(amountToLock);
    expect(balanceDiff).to.be.equal(amountToLock.toString());

    // unlocking
    await expect(game.connect(dao).unlockTokensFromBasketTEST(userAddr, 0, amountToLock)).to.be.revertedWith("ETFGame Not the owner of the basket");
    await expect(game.unlockTokensFromBasketTEST(userAddr, 0, amountToLock+1)).to.be.revertedWith("Not enough unallocated tokens in basket");
    await game.unlockTokensFromBasketTEST(userAddr, 0, amountToLock);
    await expect(game.connect(dao).basketTotalAllocatedTokens(0)).to.be.revertedWith("ETFGame Not the owner of the basket");
    unAllocatedTokens = await game.basketTotalAllocatedTokens(0);
    expect(unAllocatedTokens).to.be.equal(0);
    expect(await xaverToken.balanceOf(userAddr)).to.be.equal(balanceBefore);
  });

  it.only("Can rebalance basket, adjust delta allocations and calculate rewards", async function() {
    // minting
    await game.connect(dao).addETF(vaultMock.address);
    await game.mintNewBasket(0);

    const amount = 200_000;
    const amountUSDC = parseUSDC(amount.toString());

    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.depositETF(userAddr, amountUSDC);
    await rebalanceETF(vaultMock);

    let allocs = await getAllocations(vaultMock, allProtocols);
    allocs.forEach((protocol) => {
      console.log("alloc: %s", Number(protocol)) // 0: 40, 1: 60, 2: 20
    });

    console.log("balance user: %s", await xaverToken.balanceOf(userAddr));
    
    let newAllocations = [10, 10, 10, 10, 10];
    await game.rebalanceBasket(0, newAllocations);
    
  });

});