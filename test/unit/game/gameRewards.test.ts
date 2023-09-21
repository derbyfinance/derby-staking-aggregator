import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { parseEther as pE, parseUnits, parseUSDC } from '@testhelp/helpers';
import { setupGame } from './setup';

describe.only('Testing Game Rewards', async () => {
  const chainIds: BigNumberish[] = [10, 100, 1000];

  it('Calculate rewards during rebalance Basket', async function () {
    const { game, derbyToken, vault0, vault1, vault2, user, guardian, vaultNumber, basketId0, basketId1, basketId2 } = await setupGame();

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
      vault2.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      await game.mockRewards(vaultNumber, chainIds[0], [1, 1, 1, 1, 1]),
      await game.mockRewards(vaultNumber, chainIds[2], [1, 1, 1, 1, 1]),
    ]);

    await Promise.all([
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[0], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[1], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[2], true),
    ]);

    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await game.connect(user).rebalanceBasket(basketId0, allocations[0]);

    // This rebalance should be skipped for the basket
    await Promise.all([
      vault0.upRebalancingPeriodTEST(),
      vault1.upRebalancingPeriodTEST(),
      vault2.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [pE(2_000), pE(1_000), pE(500), pE(100), 0]),
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
      vault2.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [pE(-2_000), pE(-1_000), pE(500), pE(100), 0]),
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
      vault2.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [pE(-2_000), pE(-1_000), pE(500), pE(100), 0]),
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

    await game.connect(user).rebalanceBasket(basketId0, emptyAllocations);

    // simulating negative rewards
    let rewards = await game.connect(user).basketUnredeemedRewards(basketId0);
    // console.log({ rewards });
    expect(rewards).to.be.equal(-1_080_000);

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
      vault2.upRebalancingPeriodTEST()
    ]);
    await Promise.all([
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[0], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[1], true),
      game.connect(guardian).setRewardsReceivedTEST(vaultNumber, chainIds[2], true),
    ]);

    // user should get allocation of 1k tokens back minus the negativeReward * 50%
    const expectedTokensToBurn = parseUnits((1_080_000 * 0.5) / 0.2e6, 18);
    await expect(() =>
      game.connect(user).rebalanceBasket(basketId0, newAllocations[0]),
    ).to.changeTokenBalance(derbyToken, user, pE('1000').sub(expectedTokensToBurn));

    // unredeemedRewards should be 0
    rewards = await game.connect(user).basketUnredeemedRewards(basketId0);
    expect(rewards).to.be.equal(0);

    // Vault should receive the tokens off; negativeRewards * factor of 50%
    const balance = await derbyToken.balanceOf(vault0.address);
    expect(balance).to.be.equal(expectedTokensToBurn);
  });

  it('Should settle negative rewards when negative reward are higher then unlocked tokens', async function () {
    const { game, derbyToken, vault0, vault1, vault2, user, guardian, vaultNumber, basketId0, basketId1, basketId2 } = await setupGame();

    let allocations = [
      [pE('200'), pE('0'), pE('0'), pE('200'), pE('0')], // 400
      [pE('100'), pE('0'), pE('200'), pE('100'), pE('200')], // 600
    ];
    const totalAllocations = pE('1000');

    /*
     Setup negative rewards
    */

    await vault.upRebalancingPeriodTEST();
    await Promise.all([
      await game.mockRewards(vaultNumber, chainIds[0], [1, 1, 1, 1, 1]),
      await game.mockRewards(vaultNumber, chainIds[1], [1, 1, 1, 1, 1]),
    ]);

    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await game.connect(guardian).setNumberOfRewardsReceived(vaultNumber, 3);
    await game.connect(user).rebalanceBasket(basketId, allocations);

    // This rebalance should be skipped for the basket
    await vault.upRebalancingPeriodTEST();
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [0, 0, 0, 1000, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseUnits('-1', 24), 0, 0, 0, 0]),
    ]);

    await vault.upRebalancingPeriodTEST();
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [parseUnits('-5', 24), 0, 0, 0, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseUnits('-5', 24), 0, 0, 0, 0]),
    ]);

    await vault.upRebalancingPeriodTEST();
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [parseUnits('-5', 24), 0, 0, 0, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseUnits('-5', 24), 0, 0, 0, 0]),
    ]);

    const emptyAllocations = [
      [0, 0, 0, 0, 0], // 400
      [0, 0, 0, 0, 0], // 600
    ];
    await game.connect(user).rebalanceBasket(basketId, emptyAllocations);

    // simulating negative rewards
    let rewards = await game.connect(user).basketUnredeemedRewards(basketId);
    // console.log({ rewards });
    expect(rewards).to.be.equal(parseUSDC('-3000'));

    /*
     settle negative rewards when withdrawing all allocations
    */

    const newAllocations = [
      [0, 0, 0, 0, 0],
      [pE('-100'), 0, 0, 0, 0],
    ];

    await vault.upRebalancingPeriodTEST();
    await game.connect(guardian).setNumberOfRewardsReceived(vaultNumber, 3);
    // user should 0 tokens back, cause they are all burned (higher negative rewards then unlockedTokens)
    await expect(() =>
      game.connect(user).rebalanceBasket(basketId, newAllocations),
    ).to.changeTokenBalance(derbyToken, user, pE('0'));

    // unredeemedRewards should be -3000 + (100 / 0,5 / 0.2)
    // 100 tokens unlocked / burned at factor of 0,5 with price of 0.2
    rewards = await game.connect(user).basketUnredeemedRewards(basketId);
    // console.log({ rewards });
    expect(rewards).to.be.equal(parseUSDC('-2960'));

    // Vault should receive all the unlocked tokens
    const balance = await derbyToken.balanceOf(vault.address);
    expect(balance).to.be.equal(pE('100'));
  });
});
