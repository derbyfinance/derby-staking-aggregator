import { vaultInitSettings } from 'deploySettings';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

// task('vault_init', 'Initializes the game').setAction(async (args, { run, getNamedAccounts }) => {
//   const { guardian } = await getNamedAccounts();
//   const { gasFeeLiq, rebalanceInterval, marginScale, liquidityPercentage, performanceFee } =
//     vaultInitSettings;

//   await Promise.all([
//     run('vault_set_guardian', { guardian: guardian }),
//     run('vault_set_gas_fee_liq', { liquidity: gasFeeLiq }),
//     run('vault_set_rebalance_interval', { timestamp: rebalanceInterval }),
//     run('vault_set_margin_scale', { scale: marginScale }),
//     run('vault_set_liquidity_perc', { percentage: liquidityPercentage }),
//     run('vault_set_performance_fee', { percentage: performanceFee }),
//   ]);
// });

/*************
onlyDao
**************/

task('xcontroller_set_dao', 'Setter for dao address')
  .addParam('address', 'New dao address')
  .setAction(async ({ address }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);
    await xcontroller.connect(dao).setDao(address);
  });

task('xcontroller_set_guardian', 'Setter for guardian address')
  .addParam('guardian', 'New guardian address')
  .setAction(async ({ guardian }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);
    await xcontroller.connect(dao).setGuardian(guardian);
  });

const getXController = async ({ deployments, ethers, network }: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const { address } = await deployments.get('XChainController');
  const vault = await ethers.getContractAt('XChainController', address);
  return vault;
};

const getDao = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { dao } = await getNamedAccounts();
  return ethers.getSigner(dao);
};

const getGuardian = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { guardian } = await getNamedAccounts();
  return ethers.getSigner(guardian);
};
