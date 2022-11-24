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

  it('game_mint_basket', async function () {
    const vaultnumber = Math.floor(Math.random() * 100);
    await setupGame();

    const basketId = await run('game_mint_basket', { vaultnumber });
    const basketId1 = await run('game_mint_basket', { vaultnumber });
    expect(basketId).to.be.equal(0);
    expect(basketId1).to.be.equal(1);
  });

  /*************
  Only Guardian
  **************/

  it('game_set_xprovider', async function () {
    const vault = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const chainid = 1000;
    const vaultnumber = 20;
    const game = await setupGame();

    await run('game_set_vault_address', { vaultnumber, chainid, address: vault });
    expect(await game.getVaultAddressTest(vaultnumber, chainid)).to.be.equal(vault);
  });

  /*************
  Only Dao
  **************/

  it('game_set_xprovider', async function () {
    const provider = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const game = await setupGame();

    await run('game_set_xprovider', { provider });
    expect(await game.xProvider()).to.be.equal(provider);
  });

  it('game_set_home_vault', async function () {
    const vault = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const game = await setupGame();

    await run('game_set_home_vault', { vault });
    expect(await game.homeVault()).to.be.equal(vault);
  });

  it('game_set_rebalance_interval', async function () {
    const rebalanceInterval = Math.floor(Math.random() * 100_000_000);
    const game = await setupGame();

    await run('game_set_rebalance_interval', { timestamp: rebalanceInterval });
    expect(await game.rebalanceInterval()).to.be.equal(rebalanceInterval);
  });

  it('game_set_dao', async function () {
    const dao = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
    const game = await setupGame();

    await run('game_set_dao', { address: dao });
    expect(await game.getDao()).to.be.equal(dao);
  });

  it('game_set_guardian', async function () {
    const guardian = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
    const game = await setupGame();

    await run('game_set_guardian', { guardian });
    expect(await game.getGuardian()).to.be.equal(guardian);
  });

  it('game_set_derby_token', async function () {
    const derbyToken = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const game = await setupGame();

    await run('game_set_derby_token', { token: derbyToken });
    expect(await game.derbyToken()).to.be.equal(derbyToken);
  });

  it('game_set_negative_reward_threshold', async function () {
    const { negativeRewardThreshold } = gameDeploySettings;
    const game = await setupGame();

    await run('game_set_negative_reward_threshold', { threshold: negativeRewardThreshold });
    expect(await game.getNegativeRewardThreshold()).to.be.equal(negativeRewardThreshold);
  });

  it('game_set_negative_reward_factor', async function () {
    const { negativeRewardFactor } = gameDeploySettings;
    const game = await setupGame();

    await run('game_set_negative_reward_factor', { factor: negativeRewardFactor });
    expect(await game.getNegativeRewardFactor()).to.be.equal(negativeRewardFactor);
  });
});
