import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import { erc20, formatEther, getUSDCSigner, parseEther, parseUSDC } from '@testhelp/helpers';
import type { Controller, GameMock, MainVaultMock, DerbyToken } from '@typechain';
import { deployController, deployMainVaultMock } from '@testhelp/deploy';
import { usdc } from '@testhelp/addresses';
import { initController } from '@testhelp/vaultHelpers';
import AllMockProviders from '@testhelp/allMockProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';
import { deployGameMock, deployDerbyToken } from '@testhelp/deploy';

const basketNum = 0;
const chainIds = [10, 100, 1000];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amount = 100000;
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther((1e8).toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;
const uniswapToken = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';

describe('Testing Game', async () => {
  let vault: MainVaultMock,
    controller: Controller,
    dao: Signer,
    user: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string,
    DerbyToken: DerbyToken,
    game: GameMock;

  beforeEach(async function () {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress(),
    ]);

    controller = await deployController(dao, daoAddr);
    DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    game = await deployGameMock(
      user,
      nftName,
      nftSymbol,
      DerbyToken.address,
      daoAddr,
      daoAddr,
      controller.address,
    );
    vault = await deployMainVaultMock(
      dao,
      name,
      symbol,
      decimals,
      vaultNumber,
      daoAddr,
      daoAddr,
      game.address,
      controller.address,
      usdc,
      uScale,
      gasFeeLiquidity,
    );

    // With MOCK Providers
    await Promise.all([
      initController(controller, [game.address, vault.address]),
      game.connect(dao).setChainIds([10, 100, 1000]),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);

    await Promise.all([
      game.connect(dao).setLatestProtocolId(10, 5),
      game.connect(dao).setLatestProtocolId(100, 5),
      game.connect(dao).setLatestProtocolId(1000, 5),
      game.connect(dao).setHomeVault(vault.address),
      game.connect(dao).setNegativeRewardThreshold(-50000),
      game.connect(dao).setNegativeRewardFactor(50),
    ]);
  });

  it('Calculate rewards during rebalance Basket', async function () {
    await game.mintNewBasket(vaultNumber);

    let allocations = [
      [parseEther('200'), parseEther('0'), parseEther('0'), parseEther('200'), parseEther('0')], // 400
      [parseEther('100'), parseEther('0'), parseEther('200'), parseEther('100'), parseEther('200')], // 600
    ];
    const totalAllocations = parseEther('1000');

    /*
     Setup negative rewards
    */

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
      game.mockRewards(vaultNumber, chainIds[1], [-4_000, -2_000, 1_000, 200, 100]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [-2_000, -1_000, 500, 100, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [-4_000, -2_000, 1_000, 200, 100]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [-2_000, -1_000, 500, 100, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [-4_000, -2_000, 1_000, 200, 100]),
    ]);

    const emptyAllocations = [
      [0, 0, 0, 0, 0], // 400
      [0, 0, 0, 0, 0], // 600
    ];
    await game.rebalanceBasket(basketNum, emptyAllocations);

    // simulating negative rewards
    let rewards = await game.basketUnredeemedRewards(basketNum);
    console.log({ rewards });
    expect(rewards).to.be.equal(-1_080_000);

    /*
     settle negative rewards when withdrawing all allocations
    */

    const newAllocations = [
      [parseEther('-200'), 0, 0, parseEther('-200'), 0], // 400
      [parseEther('-100'), 0, parseEther('-200'), parseEther('-100'), parseEther('-200')], // 600
    ];

    // user should get allocation of 1k tokens back minus the negativeReward * 50%
    await expect(() => game.rebalanceBasket(basketNum, newAllocations)).to.changeTokenBalance(
      DerbyToken,
      user,
      parseEther('1000').sub(1_080_000 * 0.5),
    );

    // unredeemedRewards should be 0
    rewards = await game.basketUnredeemedRewards(basketNum);
    expect(rewards).to.be.equal(0);

    // Vault should receive the tokens off; negativeRewards * factor of 50%
    const balance = await DerbyToken.balanceOf(vault.address);
    expect(balance).to.be.equal(1_080_000 * 0.5);
  });

  it('Should settle negative rewards when negative reward are higher then unlocked tokens', async function () {
    await game.mintNewBasket(vaultNumber);

    let allocations = [
      [parseEther('200'), parseEther('0'), parseEther('0'), parseEther('200'), parseEther('0')], // 400
      [parseEther('100'), parseEther('0'), parseEther('200'), parseEther('100'), parseEther('200')], // 600
    ];
    const totalAllocations = parseEther('1000');

    /*
     Setup negative rewards
    */

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
      game.mockRewards(vaultNumber, chainIds[0], [0, 0, 0, 1000, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseEther('-1'), 0, 0, 0, 0]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [parseEther('-5'), 0, 0, 0, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseEther('-5'), 0, 0, 0, 0]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [parseEther('-5'), 0, 0, 0, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseEther('-5'), 0, 0, 0, 0]),
    ]);

    const emptyAllocations = [
      [0, 0, 0, 0, 0], // 400
      [0, 0, 0, 0, 0], // 600
    ];
    await game.rebalanceBasket(basketNum, emptyAllocations);

    // simulating negative rewards
    let rewards = await game.basketUnredeemedRewards(basketNum);
    expect(rewards).to.be.equal(parseEther('-3000'));

    /*
     settle negative rewards when withdrawing all allocations
    */

    const newAllocations = [
      [0, 0, 0, 0, 0],
      [parseEther('-100'), 0, 0, 0, 0],
    ];

    // user should 0 tokens back, cause they are all burned (higher negative rewards then unlockedTokens)
    await expect(() => game.rebalanceBasket(basketNum, newAllocations)).to.changeTokenBalance(
      DerbyToken,
      user,
      parseEther('0'),
    );

    // unredeemedRewards should be -3000 + (100 / 0,5)
    // 100 tokens unlocked / burned at factor of 0,5
    rewards = await game.basketUnredeemedRewards(basketNum);
    expect(rewards).to.be.equal(parseEther('-2800'));

    // Vault should receive all the unlocked tokens
    const balance = await DerbyToken.balanceOf(vault.address);
    expect(balance).to.be.equal(parseEther('100'));
  });
});
