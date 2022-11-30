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
CrossChain
**************/
// not tested yet
task(
  'xcontroller_push_vault_amounts',
  'Step 3; xChainController pushes exchangeRate and amount the vaults',
)
  .addParam('vaultnumber', 'Number of vault')
  .setAction(async ({ vaultnumber }, hre) => {
    const xcontroller = await getXController(hre);
    await xcontroller.pushVaultAmounts(vaultnumber);
  });
// not tested yet
task('xcontroller_send_funds_vault', 'Step 5; Push funds from xChainController to vaults')
  .addParam('vaultnumber', 'Number of vault')
  .setAction(async ({ vaultnumber }, hre) => {
    const xcontroller = await getXController(hre);
    await xcontroller.sendFundsToVault(vaultnumber);
  });

/*************
Only Guardian
**************/

/*************
Only Dao
**************/

task('xcontroller_set_vault_chain_address', 'Set Vault address and underlying for a chainId')
  .addParam('vaultnumber', 'Number of the vault', null, types.int)
  .addParam('chainid', 'Number of chain used', null, types.int)
  .addParam('address', 'Address of the Vault')
  .addParam('underlying', 'Underlying of the Vault eg USDC')
  .setAction(async ({ vaultnumber, chainid, address, underlying }, hre) => {
    const vault = await getXController(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setVaultChainAddress(vaultnumber, chainid, address, underlying);
  });

task('xcontroller_set_homexprovider', 'Setter for xProvider address')
  .addParam('address', 'New provider address')
  .setAction(async ({ address }, hre) => {
    const vault = await getXController(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setHomeXProvider(address);
  });

task('xcontroller_set_home_chain', 'Setter for new homeChain Id')
  .addParam('chainid', 'new homeChain id', null, types.int)
  .setAction(async ({ chainid }, hre) => {
    const vault = await getXController(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setHomeChainId(chainid);
  });

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

task('xcontroller_set_game', 'Setter for game address')
  .addParam('address', 'New game address')
  .setAction(async ({ address }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);

    await xcontroller.connect(dao).setGame(address);
  });

const getXController = async ({ deployments, ethers, network }: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const xControllerContract =
    network.name === 'hardhat' ? 'XChainControllerMock' : 'XChainController';
  const { address } = await deployments.get(xControllerContract);
  const vault = await ethers.getContractAt(xControllerContract, address);
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
