import { subtask, task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

// Only used for testing for now
subtask('xprovider_init', 'Initializes the xprovider')
  .addParam('xProvider', 'Provider to init', null, types.any)
  .addParam('controllerProvider', 'Provider address of the xChainController')
  .addParam('xControllerChainId', 'ChainId of the xChainController', null, types.int)
  .addParam('gameChainId', 'ChainId of the Game', null, types.int)
  .setAction(async ({ xProvider, controllerProvider, xControllerChainId, gameChainId }, hre) => {
    const dao = await getDao(hre);

    await Promise.all([
      xProvider.connect(dao).setXControllerProvider(controllerProvider),
      xProvider.connect(dao).setXControllerChainId(xControllerChainId),
      xProvider.connect(dao).setGameChainId(gameChainId),
    ]);
  });

/*************
  Only Dao
**************/
task('xprovider_set_trusted_remote', 'Set trusted provider on remote chains')
  .addParam('chainid', 'Chain is for remote xprovider', null, types.int)
  .addParam('address', 'Address of remote xprovider')
  .setAction(async ({ chainid, address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setTrustedRemote(chainid, address);
  });

task('xprovider_set_xcontroller', 'Setter for xController address')
  .addParam('address', 'New xController address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setXController(address);
  });

task('xprovider_set_xcontroller_provider', 'Setter for xControllerProvider address')
  .addParam('address', 'New game address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setXControllerProvider(address);
  });

task('xprovider_set_xcontroller_chain', 'Setter for xController chain id')
  .addParam('chainid', 'new xController chain id', null, types.int)
  .setAction(async ({ chainid }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setXControllerChainId(chainid);
  });

task('xprovider_set_home_chain', 'Setter for new homeChain Id')
  .addParam('chainid', 'new homeChain id', null, types.int)
  .setAction(async ({ chainid }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setHomeChain(chainid);
  });

task('xprovider_set_game_chain', 'Setter for gameChain Id')
  .addParam('chainid', 'new gameChain id', null, types.int)
  .setAction(async ({ chainid }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setGameChainId(chainid);
  });

task('xprovider_set_connext_chain', 'Links layerZero chain id to a connext chain')
  .addParam('layerzerochain', 'Layerzero chain id', null, types.int)
  .addParam('connextchain', 'Connext chain id', null, types.int)
  .setAction(async ({ layerzerochain, connextchain }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setConnextChainId(layerzerochain, connextchain);
  });

task('xprovider_vault_whitelist', 'Whitelists vault address for onlyVault modifier')
  .addParam('address', 'Vault address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).toggleVaultWhitelist(address);
  });

task('xprovider_set_game', 'Setter for game address')
  .addParam('address', 'New game address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setGame(address);
  });

task('xprovider_set_dao', 'Setter for dao address')
  .addParam('address', 'New dao address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setDao(address);
  });
// not tested yet

const getXProvider = async ({ deployments, ethers }: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const { address } = await deployments.get('XProvider');
  const vault = await ethers.getContractAt('XProvider', address);
  return vault;
};

const getDao = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { dao } = await getNamedAccounts();
  return ethers.getSigner(dao);
};
