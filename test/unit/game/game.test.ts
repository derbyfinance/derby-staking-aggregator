import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import {
  erc20,
  formatEther,
  getSwapDeadline,
  parseEther as pE,
  parseUSDC,
} from '@testhelp/helpers';
import type { GameMock, MainVaultMock, DerbyToken } from '@typechain';
import { usdc } from '@testhelp/addresses';
import { setupGame } from './setup';
import { getTokenConfig } from '@testhelp/deployHelpers';
import { ethers } from 'hardhat';

const uniswapToken = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';

describe('Testing Game', async () => {
  let vault: MainVaultMock,
    derbyToken: DerbyToken,
    dao: Signer,
    guardian: Signer,
    user: Signer,
    userAddr: string,
    IUSDc: Contract = erc20(usdc),
    game: GameMock,
    basketId: BigNumberish,
    vaultNumber: BigNumberish,
    chainIds: BigNumberish[] = [10, 100, 1000];

  before (async function () {
    const setup = await setupGame();
    game = setup.game;
    vault = setup.vault;
    derbyToken = setup.derbyToken;
    dao = setup.dao;
    guardian = setup.guardian;
    user = setup.user;
    userAddr = setup.userAddr;
    vaultNumber = setup.vaultNumber;
    basketId = setup.basketId;
  });

  it('DerbyToken should have name, symbol and totalSupply set', async function () {
    const tokenConfig = await getTokenConfig('hardhat');
    if (!tokenConfig) throw 'Unknown contract name';
    const { name, symbol, totalSupply } = tokenConfig;

    expect(await derbyToken.name()).to.be.equal(name);
    expect(await derbyToken.symbol()).to.be.equal(symbol);
    expect(await derbyToken.totalSupply()).to.be.equal(pE(totalSupply.toString()));
  });

  it('game should have DerbyToken contract addresses set', async function () {
    expect(await game.derbyToken()).to.be.equal(derbyToken.address);
  });

  it('Should Lock tokens, mint basket and set correct deltas', async function () {
    const allocationArray = [
      [100, 0, 0, 200, 0], // 300
      [100, 0, 200, 100, 200], // 600
      [0, 100, 200, 300, 400], // 1000
    ];
    const totalAllocations = 1900;
    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await expect(game.connect(dao).rebalanceBasket(basketId, allocationArray)).to.be.revertedWith(
      'Game: Not the owner of the basket',
    );

    await game.setRewardPerLockedTokenTEST(vaultNumber, chainIds[0], 0, 0, -1);
    await expect(game.connect(user).rebalanceBasket(basketId, allocationArray)).to.be.revertedWith(
      'Allocations to blacklisted protocol',
    );
    await game.setRewardPerLockedTokenTEST(vaultNumber, chainIds[0], 0, 0, 0);

    await expect(() =>
      game.connect(user).rebalanceBasket(basketId, allocationArray),
    ).to.changeTokenBalance(derbyToken, user, -1900);

    expect(await game.connect(user).getDeltaAllocationChain(vaultNumber, chainIds[0])).to.be.equal(
      300,
    );
    expect(await game.connect(user).getDeltaAllocationChain(vaultNumber, chainIds[1])).to.be.equal(
      600,
    );
    expect(await game.connect(user).getDeltaAllocationChain(vaultNumber, chainIds[2])).to.be.equal(
      1000,
    );
    expect(await game.connect(user).basketTotalAllocatedTokens(basketId)).to.be.equal(
      totalAllocations,
    );

    // checking all allocations set in allocationArray above
    const chainId0 = await Promise.all(
      allocationArray[0].map((reward, i) => {
        return game.connect(user).basketAllocationInProtocol(basketId, chainIds[0], i);
      }),
    );
    const chainId1 = await Promise.all(
      allocationArray[1].map((reward, i) => {
        return game.connect(user).basketAllocationInProtocol(basketId, chainIds[1], i);
      }),
    );
    const chainId2 = await Promise.all(
      allocationArray[2].map((reward, i) => {
        return game.connect(user).basketAllocationInProtocol(basketId, chainIds[2], i);
      }),
    );

    expect(chainId0).to.deep.equal(allocationArray[0]);
    expect(chainId1).to.deep.equal(allocationArray[1]);
    expect(chainId2).to.deep.equal(allocationArray[2]);
  });

  it('Should Unlock tokens and read allocations in basket', async function () {
    const allocationArray = [
      [-100, 0, 0, 0, 0],
      [0, 0, -100, -100, -200],
      [0, 0, -200, -200, -100],
    ];

    const allocationTestArray = [
      [0, 0, 0, 200, 0], // 200
      [100, 0, 100, 0, 0], // 200
      [0, 100, 0, 100, 300], // 500
    ];

    // blacklisting protocol, user should still be able to unlock the tokens
    await vault.upRebalancingPeriodTEST();
    await game.connect(guardian).setNumberOfRewardsReceived(vaultNumber, 3);
    await game.setRewardPerLockedTokenTEST(vaultNumber, chainIds[0], 0, 0, -1);

    await expect(() =>
      game.connect(user).rebalanceBasket(basketId, allocationArray),
    ).to.changeTokenBalance(derbyToken, user, 1000);

    expect(await game.getDeltaAllocationChain(vaultNumber, chainIds[0])).to.be.equal(200);
    expect(await game.getDeltaAllocationChain(vaultNumber, chainIds[1])).to.be.equal(200);
    expect(await game.getDeltaAllocationChain(vaultNumber, chainIds[2])).to.be.equal(500);
    expect(await game.connect(user).basketTotalAllocatedTokens(basketId)).to.be.equal(1900 - 1000);

    // looping through all of the allocationArray
    const chainId0 = await Promise.all(
      allocationArray[0].map((reward, i) => {
        return game.connect(user).basketAllocationInProtocol(basketId, chainIds[0], i);
      }),
    );
    const chainId1 = await Promise.all(
      allocationArray[1].map((reward, i) => {
        return game.connect(user).basketAllocationInProtocol(basketId, chainIds[1], i);
      }),
    );
    const chainId2 = await Promise.all(
      allocationArray[2].map((reward, i) => {
        return game.connect(user).basketAllocationInProtocol(basketId, chainIds[2], i);
      }),
    );

    expect(chainId0).to.deep.equal(allocationTestArray[0]);
    expect(chainId1).to.deep.equal(allocationTestArray[1]);
    expect(chainId2).to.deep.equal(allocationTestArray[2]);
  });

  it('Calculate rewards during rebalance Basket', async function () {
    await mockRewards(game, vault, derbyToken, user, vaultNumber, basketId, chainIds);

    const newAllocations = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ];
    await game.connect(user).rebalanceBasket(basketId, newAllocations);

    // allocations in mockRewards function
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
    const rewards = await game.connect(user).basketUnredeemedRewards(basketId);
    expect(rewards).to.be.equal(2_120_000); // rebalancing period not correct? CHECK
  });

  it('Should be able to redeem rewards / set rewardAllowance', async function () {
    await game.connect(user).redeemRewards(basketId);
    await expect(game.connect(user).redeemRewards(basketId)).to.be.revertedWith('Nothing to claim');

    expect(await vault.getRewardAllowanceTEST(userAddr)).to.be.equal(2_120_000);
    expect(await vault.getTotalWithdrawalRequestsTEST()).to.be.equal(2_120_000);
  });

  it('Should redeem and swap rewards to UNI tokens', async function () {
    const IUniswap = erc20(uniswapToken);

    await Promise.all([
      vault.connect(dao).setDaoToken(uniswapToken),
      vault.setExchangeRateTEST(parseUSDC('1')),
    ]);

    // Deposit so the vault has funds
    await vault.connect(user).deposit(parseUSDC('10000')); // 10k

    await Promise.all([vault.upRebalancingPeriodTEST(), vault.setTotalWithdrawalRequestsTEST(2_120_000)]);
    expect(await vault.getTotalWithdrawalRequestsTEST()).to.be.equal(2_120_000);

    // Uniswap token is about $8, so should receive atleast (2_120_000 / 1E6) / 8 = 0.3
    await vault.connect(user).withdrawRewards(getSwapDeadline(), 0);
    const balance = formatEther(await IUniswap.balanceOf(userAddr));
    expect(Number(balance)).to.be.greaterThan(0.3);

    // Trying to withdraw again, should revert
    await expect(vault.connect(user).withdrawRewards(getSwapDeadline(), 0)).to.be.revertedWith(
      '!Allowance',
    );

    expect(await vault.getRewardAllowanceTEST(userAddr)).to.be.equal(0);
    expect(await vault.getTotalWithdrawalRequestsTEST()).to.be.equal(0);
  });

  it('Mocking rewards again to test when swappingRewards is false', async function () {
    await mockRewards(game, vault, derbyToken, user, vaultNumber, basketId, chainIds);

    const newAllocations = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ];
    await game.connect(user).rebalanceBasket(basketId, newAllocations);
    await game.connect(user).redeemRewards(basketId);

    // double the allocations
    expect(await vault.getRewardAllowanceTEST(userAddr)).to.be.equal(4_240_000);
  });

  it('Should redeem rewards and receive USDC instead of UNI tokens', async function () {
    // Swaprewards to false
    await vault.connect(dao).setSwapRewards(false);

    await Promise.all([vault.upRebalancingPeriodTEST(), vault.setTotalWithdrawalRequestsTEST(4_240_000)]);
    expect(await vault.getTotalWithdrawalRequestsTEST()).to.be.equal(4_240_000);

    await expect(() =>
      vault.connect(user).withdrawRewards(getSwapDeadline(), 0),
    ).to.changeTokenBalance(IUSDc, user, 4_240_000);

    expect(await vault.getRewardAllowanceTEST(userAddr)).to.be.equal(0);
    expect(await vault.getTotalWithdrawalRequestsTEST()).to.be.equal(0);
  });
});

export async function mockRewards(
  game: GameMock,
  vault: MainVaultMock,
  DerbyToken: DerbyToken,
  user: Signer,
  vaultNum: BigNumberish,
  basketId: BigNumberish,
  chainIds: BigNumberish[],
) {
  let allocations = [
    [pE('200'), pE('0'), pE('0'), pE('200'), pE('0')], // 400
    [pE('100'), pE('0'), pE('200'), pE('100'), pE('200')], // 600
  ];
  const totalAllocations = pE('1000');

  await vault.upRebalancingPeriodTEST();
  await Promise.all([
    game.mockRewards(vaultNum, chainIds[0], [1, 1, 1, 1, 1]),
    game.mockRewards(vaultNum, chainIds[1], [1, 1, 1, 1, 1]),
  ]);

  await DerbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
  await game.connect(user).rebalanceBasket(basketId, allocations);

  // This rebalance should be skipped for the basket
  // all rewards have to be scaled by 1e18
  await vault.upRebalancingPeriodTEST();
  await Promise.all([
    game.mockRewards(vaultNum, chainIds[0], [pE(2_000), pE(1_000), pE(500), pE(100), 0]),
    game.mockRewards(vaultNum, chainIds[1], [pE(4_000), pE(2_000), pE(1_000), pE(200), pE(100)]),
  ]);

  await vault.upRebalancingPeriodTEST();
  await Promise.all([
    game.mockRewards(vaultNum, chainIds[0], [pE(2_000), pE(1_000), pE(500), pE(100), 0]),
    game.mockRewards(vaultNum, chainIds[1], [pE(4_000), pE(2_000), pE(1_000), pE(200), pE(100)]),
  ]);

  await vault.upRebalancingPeriodTEST();
  await Promise.all([
    game.mockRewards(vaultNum, chainIds[0], [pE(2_000), pE(1_000), pE(500), pE(100), 0]),
    game.mockRewards(vaultNum, chainIds[1], [pE(4_000), pE(2_000), pE(1_000), pE(200), pE(100)]),
  ]);
}
