import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { parseEther as pE, parseUnits, parseUSDC } from '@testhelp/helpers';
import { setupGame } from './setup';

describe('Testing Game Rewards', async () => {
  const chainIds: BigNumberish[] = [10, 100, 1000, 10000];

  it('Calculate rewards during rebalance Basket', async function () {
    const { game, derbyToken, vault0, vault1, vault2, vault3, user, guardian, vaultNumber, basketId0, basketId1, basketId2, basketId3 } = await setupGame();

    let allocations = [
      [pE('200'), pE('0'), pE('0'), pE('200'), pE('0')], // 400
      [pE('100'), pE('0'), pE('200'), pE('100'), pE('200')], // 600
    ];
    const totalAllocations = pE('400');

    /*
     Setup negative rewards
    */
    await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      await game.mockRewards(vaultNumber, chainIds[3], [1, 1, 1, 1, 1]),
      await game.mockRewards(vaultNumber, chainIds[2], [1, 1, 1, 1, 1]),
    ]);

    await Promise.all([
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[0], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[1], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[2], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[3], true),
    ]);

    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await game.connect(user).rebalanceBasket(basketId3, allocations[0]);

    // This rebalance should be skipped for the basket
    await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[3], [pE(2_000), pE(1_000), pE(500), pE(100), 0]),
      game.mockRewards(vaultNumber, chainIds[1], [
        pE(-4_000),
        pE(-2_000),
        pE(1_000),
        pE(200),
        pE(100),
      ]),
    ]);

    await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[3], [pE(-2_000), pE(-1_000), pE(500), pE(100), 0]),
      game.mockRewards(vaultNumber, chainIds[1], [
        pE(-4_000),
        pE(-2_000),
        pE(1_000),
        pE(200),
        pE(100),
      ]),
    ]);

    await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[3], [pE(-2_000), pE(-1_000), pE(500), pE(100), 0]),
      game.mockRewards(vaultNumber, chainIds[1], [
        pE(-4_000),
        pE(-2_000),
        pE(1_000),
        pE(200),
        pE(100),
      ]),
    ]);

    const emptyAllocations = [
      [0, 0, 0, 0, 0], // 400
      [0, 0, 0, 0, 0], // 600
    ];

    await game.connect(user).rebalanceBasket(basketId3, emptyAllocations[0]);

    // simulating negative rewards
    let rewards = await game.connect(user).basketUnredeemedRewards(basketId3);
    // console.log({ rewards });
    expect(rewards).to.be.equal(-760_000);

    /*
     settle negative rewards when withdrawing all allocations
    */

    const newAllocations = [
      [pE('-200'), 0, 0, pE('-200'), 0], // 400
      [pE('-100'), 0, pE('-200'), pE('-100'), pE('-200')], // 600
    ];

    await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[0], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[1], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[2], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[3], true),
    ]);

    await Promise.all([
      game.upRebalancingPeriodTEST(vaultNumber, chainIds[0]),
      game.upRebalancingPeriodTEST(vaultNumber, chainIds[1]),
      game.upRebalancingPeriodTEST(vaultNumber, chainIds[2]),
      game.upRebalancingPeriodTEST(vaultNumber, chainIds[3]),
    ]);

    // user should get allocation of 1k tokens back minus the negativeReward * 50%
    const expectedTokensToBurn = parseUnits((760_000 * 0.5) / 0.2e6, 18);
    await expect(() =>
      game.connect(user).rebalanceBasket(basketId3, newAllocations[0]),
    ).to.changeTokenBalance(derbyToken, user, pE('400').sub(expectedTokensToBurn));

    // unredeemedRewards should be 0
    rewards = await game.connect(user).basketUnredeemedRewards(basketId3);
    expect(rewards).to.be.equal(0);

    // Vault should receive the tokens off; negativeRewards * factor of 50%
    const balance = await derbyToken.balanceOf(vault3.address);
    expect(balance).to.be.equal(expectedTokensToBurn);
  });

  it('Should settle negative rewards when negative reward are higher then unlocked tokens', async function () {
    const { game, derbyToken, vault0, vault1, vault2, vault3, user, guardian, vaultNumber, basketId0, basketId1, basketId2, basketId3 } = await setupGame();

    let allocations = [
      [pE('200'), pE('0'), pE('0'), pE('200'), pE('0')], // 400
      [pE('100'), pE('0'), pE('200'), pE('100'), pE('200')], // 600
    ];
    const totalAllocations = pE('1000');

    /*
     Setup negative rewards
    */

     await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      await game.mockRewards(vaultNumber, chainIds[3], [1, 1, 1, 1, 1]),
      await game.mockRewards(vaultNumber, chainIds[1], [1, 1, 1, 1, 1]),
    ]);

    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
        await Promise.all([
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[0], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[1], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[2], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[3], true),
    ]);
    await game.connect(user).rebalanceBasket(basketId3, allocations[0]);

    // This rebalance should be skipped for the basket
        await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[3], [0, 0, 0, 1000, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseUnits('-1', 24), 0, 0, 0, 0]),
    ]);

        await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[3], [parseUnits('-5', 24), 0, 0, 0, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseUnits('-5', 24), 0, 0, 0, 0]),
    ]);

        await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[3], [parseUnits('-5', 24), 0, 0, 0, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseUnits('-5', 24), 0, 0, 0, 0]),
    ]);

    const emptyAllocations = [
      [0, 0, 0, 0, 0], // 400
      [0, 0, 0, 0, 0], // 600
    ];
    await game.connect(user).rebalanceBasket(basketId3, emptyAllocations[0]);

    // simulating negative rewards
    let rewards = await game.connect(user).basketUnredeemedRewards(basketId3);
    // console.log({ rewards });
    expect(rewards).to.be.equal(parseUSDC('-2000'));

    /*
     settle negative rewards when withdrawing all allocations
    */

    const newAllocations = [
      [0, 0, 0, 0, 0],
      [pE('-100'), 0, 0, 0, 0],
    ];

    await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST(),
      vault3.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[0], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[1], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[2], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[3], true),
    ]);

    await Promise.all([
      game.upRebalancingPeriodTEST(vaultNumber, chainIds[0]),
      game.upRebalancingPeriodTEST(vaultNumber, chainIds[1]),
      game.upRebalancingPeriodTEST(vaultNumber, chainIds[2]),
      game.upRebalancingPeriodTEST(vaultNumber, chainIds[3]),
    ]);
    // user should 0 tokens back, cause they are all burned (higher negative rewards then unlockedTokens)
    await expect(() =>
      game.connect(user).rebalanceBasket(basketId3, newAllocations[0]),
    ).to.changeTokenBalance(derbyToken, user, pE('0'));

    // unredeemedRewards should be -3000 + (100 / 0,5 / 0.2)
    // 100 tokens unlocked / burned at factor of 0,5 with price of 0.2
    rewards = await game.connect(user).basketUnredeemedRewards(basketId3);
    // console.log({ rewards });
    expect(rewards).to.be.equal(parseUSDC('-2000'));

    // Vault should receive all the unlocked tokens
    const balance = await derbyToken.balanceOf(vault3.address);
    expect(balance).to.be.equal(pE('0'));
  });
});
