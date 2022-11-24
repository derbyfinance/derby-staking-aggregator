import { gameDeploySettings } from 'deploySettings';
import { Result } from 'ethers/lib/utils';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('game_init', 'Initializes the game').setAction(async (args, { run }) => {
  const { negativeRewardThreshold, negativeRewardFactor } = gameDeploySettings;

  await Promise.all([
    run('game_set_negative_reward_factor', { factor: negativeRewardFactor }),
    run('game_set_negative_reward_threshold', { threshold: negativeRewardThreshold }),
  ]);
});

task('game_mint_basket', 'Mints a new NFT with a Basket of allocations')
  .addParam('vaultnumber', 'Number of the vault. Same as in Router', null, types.int)
  .setAction(async ({ vaultnumber }, hre) => {
    const game = await getGame(hre);
    const tx = await game.mintNewBasket(vaultnumber);
    const receipt = await tx.wait();
    const { basketId } = receipt.events![1].args as Result;
    return Number(basketId);
  });

/*************
CrossChain
**************/
// not tested yet
task('game_trigger_step_1', 'Game pushes totalDeltaAllocations to xChainController')
  .addParam('vaultnumber', 'New dao address', null, types.int)
  .setAction(async ({ vaultnumber }, hre) => {
    const game = await getGame(hre);
    await game.pushAllocationsToController(vaultnumber);
  });
// not tested yet
task('game_trigger_step_6', 'Game pushes deltaAllocations to vaults')
  .addParam('vaultnumber', 'New dao address', null, types.int)
  .setAction(async ({ vaultnumber }, hre) => {
    const game = await getGame(hre);
    await game.pushAllocationsToVaults(vaultnumber);
  });

/*************
Only Guardian
**************/

task('game_set_vault_address', 'Link a chainId to a vault address for cross chain functions')
  .addParam('vaultnumber', 'Number of the vault', null, types.int)
  .addParam('chainid', 'chainId vault is on', null, types.int)
  .addParam('address', 'address of the vault')
  .setAction(async ({ vaultnumber, chainid, address }, hre) => {
    const game = await getGame(hre);
    const guardian = await getGuardian(hre);
    await game.connect(guardian).setVaultAddress(vaultnumber, chainid, address);
  });

/*************
Only Dao
**************/

task('game_set_xprovider', 'Setter for xProvider address')
  .addParam('provider', 'xProvider address')
  .setAction(async ({ provider }, hre) => {
    const game = await getGame(hre);
    const dao = await getDao(hre);
    await game.connect(dao).setXProvider(provider);
  });

task('game_set_home_vault', 'Setter for homeVault address')
  .addParam('vault', 'homeVault address')
  .setAction(async ({ vault }, hre) => {
    const game = await getGame(hre);
    const dao = await getDao(hre);
    await game.connect(dao).setHomeVault(vault);
  });

task('game_set_rebalance_interval', 'Set minimum interval for the rebalance function')
  .addParam('timestamp', 'UNIX timestamp', null, types.int)
  .setAction(async ({ timestamp }, hre) => {
    const game = await getGame(hre);
    const dao = await getDao(hre);
    await game.connect(dao).setRebalanceInterval(timestamp);
  });

task('game_set_dao', 'Setter for dao address')
  .addParam('address', 'New dao address')
  .setAction(async ({ address }, hre) => {
    const game = await getGame(hre);
    const dao = await getDao(hre);
    await game.connect(dao).setDao(address);
  });

task('game_set_guardian', 'Setter for guardian address')
  .addParam('guardian', 'New guardian address')
  .setAction(async ({ guardian }, hre) => {
    const game = await getGame(hre);
    const dao = await getDao(hre);
    await game.connect(dao).setGuardian(guardian);
  });

task('game_set_derby_token', 'Setter for Derby token address')
  .addParam('token', 'New Derby token address')
  .setAction(async ({ token }, hre) => {
    const game = await getGame(hre);
    const dao = await getDao(hre);
    await game.connect(dao).setDerbyToken(token);
  });

task('game_set_negative_reward_threshold', 'Threshold at which user tokens will be sold / burned')
  .addParam('threshold', 'Percentage of tokens that will be sold / burned', null, types.int)
  .setAction(async ({ threshold }, hre) => {
    if (threshold >= 0) throw 'Threshold must be negative';
    const game = await getGame(hre);
    const dao = await getDao(hre);
    await game.connect(dao).setNegativeRewardThreshold(threshold);
  });

task('game_set_negative_reward_factor', 'Setter for negativeRewardFactor')
  .addParam('factor', 'Percentage of tokens that will be sold / burned', null, types.int)
  .setAction(async ({ factor }, hre) => {
    const game = await getGame(hre);
    const dao = await getDao(hre);
    await game.connect(dao).setNegativeRewardFactor(factor);
  });

const getGame = async ({ deployments, ethers, network }: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const gameContract = network.name === 'hardhat' ? 'GameMock' : 'Game';
  const { address } = await deployments.get(gameContract);
  const game = await ethers.getContractAt(gameContract, address);
  return game;
};

const getDao = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const accounts = await getNamedAccounts();
  const dao = await ethers.getSigner(accounts.dao);
  return dao;
};

const getGuardian = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const accounts = await getNamedAccounts();
  const guardian = await ethers.getSigner(accounts.guardian);
  return guardian;
};
