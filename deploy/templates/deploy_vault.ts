import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getDeployConfigVault } from '@testhelp/deployHelpers';

const vaultName = 'MainVault';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const deployConfig = await getDeployConfigVault(vaultName, network.name);
  if (!deployConfig) throw 'Unknown contract name';

  const { name, symbol, decimals, vaultNumber, vaultCurrency, uScale } = deployConfig;

  const swapLibrary = await deployments.get('Swap');
  const game = await deployments.get('Game');
  const controller = await deployments.get('Controller');

  await deploy(vaultName, {
    from: deployer,
    contract: 'MainVault',
    args: [
      name,
      symbol,
      decimals,
      vaultNumber,
      dao,
      game.address,
      controller.address,
      vaultCurrency,
      uScale,
    ],
    libraries: {
      Swap: swapLibrary.address,
    },
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = [vaultName];
func.dependencies = ['Swap', 'Controller', 'Game'];
