import { controllerInit } from 'deploySettings';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const getGame = async ({ deployments, ethers, network }: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const gameContract = network.name === 'hardhat' ? 'GameMock' : 'Game';
  const [dao] = await ethers.getSigners();
  const { address } = await deployments.get(gameContract);
  const game = await ethers.getContractAt(gameContract, address);
  return { game, dao };
};

task('game_mint_basket', 'Mints a new NFT with a Basket of allocations')
  .addParam('vaultnumber', 'Number of the vault. Same as in Router', null, types.int)
  .setAction(async ({ vaultnumber }, hre) => {
    const { game } = await getGame(hre);
    await game.mintNewBasket(vaultnumber);
  });

/*************
Only Dao
**************/

task('game_set_dao', 'Setter for dao address')
  .addParam('address', 'New dao address')
  .setAction(async ({ address }, hre) => {
    const { game, dao } = await getGame(hre);
    await game.connect(dao).setDao(address);
  });

task('game_set_negative_reward_factor', 'Setter for negativeRewardFactor')
  .addParam('factor', 'Percentage of tokens that will be sold / burned', null, types.int)
  .setAction(async ({ factor }, hre) => {
    const { game, dao } = await getGame(hre);
    await game.connect(dao).setNegativeRewardFactor(factor);
  });
