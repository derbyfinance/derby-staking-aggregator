import { getInitConfigGame } from '@testhelp/deployHelpers';
import { Result } from 'ethers/lib/utils';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('game_init', 'Initializes the game')
  .addParam('provider', 'Address of the provider')
  .setAction(async ({ provider }, { run, network }) => {
    const initConfig = await getInitConfigGame(network.name);
    if (!initConfig) throw 'Unknown contract name';

    const { negativeRewardThreshold, negativeRewardFactor, tokenPrice } = initConfig;
    const vaultnumber = 10;

    await run('game_set_negative_reward_factor', { factor: negativeRewardFactor });
    await run('game_set_negative_reward_threshold', { threshold: negativeRewardThreshold });
    await run('game_set_xprovider', { provider });
    await run('game_set_vault_token_price', { vaultnumber, price: tokenPrice });
  });

task('game_mint_basket', 'Mints a new NFT with a Basket of allocations')
  .addParam('chainid', 'Chain Id of chain on which the vault is deployed', null, types.int)
  .addParam('vaultnumber', 'Number of the vault. Same as in Router', null, types.int)
  .setAction(async ({ chainid, vaultnumber }, hre) => {
    const game = await getGame(hre);
    const user = await getUser(hre);
    const tx = await game.connect(user).mintNewBasket(chainid, vaultnumber);
    const receipt = await tx.wait();
    const { basketId } = receipt.events![1].args as Result;
    return Number(basketId);
  });

/*************
CrossChain
**************/
// not tested yet
task('game_trigger_step_6', 'Game pushes deltaAllocations to vaults')
  .addParam('vaultnumber', 'New dao address', null, types.int)
  .setAction(async ({ vaultnumber }, hre) => {
    const game = await getGame(hre);
    await game.pushAllocationsToVault(vaultnumber);
  });

/*************
Only Guardian
**************/

task('game_set_vault_token_price', 'Set tokenPrice in vaultCurrency / derbyTokenPrice')
  .addParam('vaultnumber', 'Number of the vault', null, types.int)
  .addParam('price', 'tokenPrice in vaultCurrency / derbyTokenPrice', null, types.int)
  .setAction(async ({ vaultnumber, price }, hre) => {
    const game = await getGame(hre);
    const guardian = await getGuardian(hre);
    await game.connect(guardian).setTokenPrice(vaultnumber, price);
  });

task('game_set_vault_address', 'Link a chainId to a vault address for cross chain functions')
  .addParam('vaultnumber', 'Number of the vault', null, types.int)
  .addParam('chainid', 'chainId vault is on', null, types.int)
  .addParam('address', 'address of the vault')
  .setAction(async ({ vaultnumber, chainid, address }, hre) => {
    const game = await getGame(hre);
    const guardian = await getGuardian(hre);
    await game.connect(guardian).setVaultAddress(vaultnumber, chainid, address);
  });

task('game_latest_protocol_id', 'Setter for latest protocol Id for given chainId')
  .addParam('chainid', 'Number of chain id set in chainIds array', null, types.int)
  .addParam('vaultnumber', 'Number of the vault', null, types.int)
  .addParam('latestprotocolid', 'Number of supported protocol vaults', null, types.int)
  .setAction(async ({ chainid, vaultnumber, latestprotocolid }, hre) => {
    const game = await getGame(hre);
    const guardian = await getGuardian(hre);
    await game.connect(guardian).setLatestProtocolId(chainid, vaultnumber, latestprotocolid);
  });

task('game_settle_rewards_guard', 'Guardian function for step 8')
  .addParam('vaultnumber', 'Number of the vault', null, types.int)
  .addParam('chainid', 'Number of chain id set in chainIds array', null, types.int)
  .addVariadicPositionalParam('rewards', 'array of rewards', [], types.int)
  .setAction(async ({ vaultnumber, chainid, rewards }, hre) => {
    const game = await getGame(hre);
    const guardian = await getGuardian(hre);
    await game.connect(guardian).settleRewardsGuard(vaultnumber, chainid, rewards);
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

const getUser = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const accounts = await getNamedAccounts();
  const user = await ethers.getSigner(accounts.user);
  return user;
};

const getGuardian = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const accounts = await getNamedAccounts();
  const guardian = await ethers.getSigner(accounts.guardian);
  return guardian;
};
