/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert, use } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC, parseEther } from './helpers/helpers';
import { ETFVaultMock, ETFGame, XaverToken, BasketToken } from '../typechain-types';
import { getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
import { beforeEachETFVault, Protocol } from "./helpers/vaultBeforeEach";
import { deployETFGame, deployBasketToken, deployXaverToken } from "./helpers/deploy";

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

describe("Deploy Contracts and interact with Vault", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolAave: Protocol,
  protocolYearn: Protocol,
  allProtocols: Protocol[],
  router: Contract,
  game: ETFGame,
  xaverToken: XaverToken,
  basketToken: BasketToken;

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn],
      allProtocols,
      IUSDc,,,,,
      router,,,,,,,
      dao
    ] = await beforeEachETFVault(amountUSDC)

    const daoAddr = await dao.getAddress();
    xaverToken = await deployXaverToken(user, name, symbol, totalXaverSupply);
    game = await deployETFGame(user, xaverToken.address, daoAddr);  
    basketToken = await deployBasketToken(user, game.address, nftName, nftSymbol);
    await game.connect(dao).setupBasketContractAddress(basketToken.address);
  });

  it("XaverToken should have name, symbol and totalSupply set", async function() {
    expect(await xaverToken.name()).to.be.equal(name);
    expect(await xaverToken.symbol()).to.be.equal(symbol);
    expect(await xaverToken.totalSupply()).to.be.equal(totalXaverSupply);
  });

  it("BasketToken should have name, symbol and game contract address set", async function() {
    expect(await basketToken.name()).to.be.equal(nftName);
    expect(await basketToken.symbol()).to.be.equal(nftSymbol);
    expect(await basketToken.ETFgame()).to.be.equal(game.address);
  });

  it("ETFGame should have xaverToken and basketToken contract addresses set", async function() {
    expect(await game.xaverTokenAddress()).to.be.equal(xaverToken.address);
    expect(await game.basketTokenAddress()).to.be.equal(basketToken.address);
  });
  
  it("Can add a vault", async function() {
    await expect(game.addETF(vaultMock.address)).to.be.revertedWith("ETFvault: only DAO");
    let latestETFNumber = await game.latestETFNumber();
    expect(latestETFNumber).to.be.equal(0);
    await game.connect(dao).addETF(vaultMock.address);
    latestETFNumber = await game.latestETFNumber();
    expect(latestETFNumber).to.be.equal(1);
    expect(await game.ETFVaults(0)).to.be.equal(vaultMock.address);
  });

  it("Can mint a basket NFT and lock xaver tokens in it", async function() {
    await game.connect(dao).addETF(vaultMock.address);
    await game.mintNewBasket(0);
    const ownerOfNFT = await basketToken.ownerOf(0);
    const userAddr = await user.getAddress();
    expect(ownerOfNFT).to.be.equal(userAddr);

    await game.connect(user).lockTokensToBasket(userAddr, 0, 1000);
    const unlockedTokens = await game.basketTotalUnAllocatedTokens(0);
    console.log("unlockedTokens %s", unlockedTokens);
  });

});