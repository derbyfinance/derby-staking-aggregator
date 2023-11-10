import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { GameMock } from '@typechain';
import { getInitConfigGame } from '@testhelp/deployHelpers';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { getAllSigners } from '@testhelp/getContracts';
import { abi } from 'artifacts/contracts/Vault.sol/Vault.json';

describe('Testing game tasks', () => {
  const setupGame = deployments.createFixture(async (hre) => {
    const { deployments, ethers, network } = hre;
    await deployments.fixture(['GameMock']);
    const deployment = await deployments.get('GameMock');
    const game: GameMock = await ethers.getContractAt('GameMock', deployment.address);
    const [dao] = await getAllSigners(hre);

    const gameConfig = await getInitConfigGame(network.name);
    if (!gameConfig) throw 'Unknown contract name';

    const dummyProvider = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
    const vaultMock = await deployMockContract(dao, abi);
    await vaultMock.mock.rebalancingPeriod.returns(0);

    await run('game_init', { provider: dummyProvider, homevault: vaultMock.address });

    return { game, vaultMock, gameConfig };
  });

  const random = (max: number) => Math.floor(Math.random() * max);

  it('game_mint_basket', async function () {
    const { game } = await setupGame();
    const chainid = 10;
    const vaultnumber = 10;

    const basketId = await run('game_mint_basket', { chainid, vaultnumber });
    const basketId1 = await run('game_mint_basket', { chainid, vaultnumber });
    expect(basketId).to.be.equal(0);
    expect(basketId1).to.be.equal(1);
    expect(await game.tokenPrice(10)).to.be.equal(200000);
  });

  /*************
  Only Guardian
  **************/

  it('game_set_vault_address', async function () {
    const { game } = await setupGame();
    const vault = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const chainid = random(10_000);
    const vaultnumber = random(100);

    await run('game_set_vault_address', { vaultnumber, chainid, address: vault });
    expect(await game.getVaultAddressTest(vaultnumber, chainid)).to.be.equal(vault);
  });

  it('game_latest_protocol_id', async function () {
    const { game } = await setupGame();
    const chainid = random(10_000);
    const vaultnumber = random(100);
    const latestprotocolid = random(100);

    await run('game_latest_protocol_id', { chainid, vaultnumber, latestprotocolid });
    expect(await game.getVaultsLatestProtocolIdTEST(chainid, vaultnumber)).to.be.equal(latestprotocolid);
  });

  it('game_settle_rewards_guard', async function () {
    const { game, vaultMock } = await setupGame();
    const rewards = [
      random(10_000e6),
      random(10_000e6),
      random(10_000e6),
      random(10_000e6),
      random(10_000e6),
      random(10_000e6),
    ];
    const vaultnumber = 10;
    const chainid = random(10_000);
    const period = 1;

    await vaultMock.mock.rebalancingPeriod.returns(1);
    await run('game_settle_rewards_guard', { vaultnumber, chainid, rewards });

    const rewardsPromise = rewards.map((reward, i) => {
      return game.getRewardsPerLockedTokenTEST(vaultnumber, chainid, period, i);
    });

    const gameRewards = await Promise.all(rewardsPromise);
    expect(gameRewards).to.be.deep.equal(rewards);
  });

  /*************
  Only Dao
  **************/

  it('game_set_xprovider', async function () {
    const { game } = await setupGame();
    const provider = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

    await run('game_set_xprovider', { provider });
    expect(await game.xProvider()).to.be.equal(provider);
  });

  it('game_set_dao', async function () {
    const { game } = await setupGame();
    const dao = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';

    await run('game_set_dao', { address: dao });
    expect(await game.getDao()).to.be.equal(dao);
  });

  it('game_set_guardian', async function () {
    const { game } = await setupGame();
    const guardian = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('game_set_guardian', { guardian });
    expect(await game.getGuardian()).to.be.equal(guardian);
  });

  it('game_set_derby_token', async function () {
    const { game } = await setupGame();
    const derbyToken = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

    await run('game_set_derby_token', { token: derbyToken });
    expect(await game.derbyToken()).to.be.equal(derbyToken);
  });

  it('game_set_negative_reward_threshold', async function () {
    const { game, gameConfig } = await setupGame();
    const { negativeRewardThreshold } = gameConfig;

    await run('game_set_negative_reward_threshold', { threshold: negativeRewardThreshold });
    expect(await game.getNegativeRewardThreshold()).to.be.equal(negativeRewardThreshold);
  });

  it('game_set_negative_reward_factor', async function () {
    const { game, gameConfig } = await setupGame();
    const { negativeRewardFactor } = gameConfig;

    await run('game_set_negative_reward_factor', { factor: negativeRewardFactor });
    expect(await game.getNegativeRewardFactor()).to.be.equal(negativeRewardFactor);
  });
});
