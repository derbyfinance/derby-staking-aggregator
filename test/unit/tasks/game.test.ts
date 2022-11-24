import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { usdc, yearn, yearnUSDC } from '@testhelp/addresses';
import { gameDeploySettings } from 'deploySettings';
import { GameMock } from '@typechain';

describe.only('Testing game tasks', () => {
  const setupGame = deployments.createFixture(async ({ deployments, ethers }) => {
    await deployments.fixture(['GameMock']);
    const deployment = await deployments.get('GameMock');
    const game: GameMock = await ethers.getContractAt('GameMock', deployment.address);

    return game;
  });

  it('game_set_dao', async function () {
    const dao = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
    const game = await setupGame();

    await run('game_set_dao', { address: dao });
    expect(await game.getDao()).to.be.equal(dao);
  });

  it('game_set_negative_reward_factor', async function () {
    const { negativeRewardFactor } = gameDeploySettings;
    const game = await setupGame();

    await run('game_set_negative_reward_factor', { factor: negativeRewardFactor });
    expect(await game.getNegativeRewardFactor()).to.be.equal(negativeRewardFactor);
  });
});
