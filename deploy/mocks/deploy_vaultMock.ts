import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { vaultDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao, guardian } = await getNamedAccounts();

  const { name, symbol, decimals, vaultNumber, vaultCurrency, uScale } = vaultDeploySettings;

  const swapLibrary = await deployments.get('Swap');
  const game = await deployments.get('Game');
  const controller = await deployments.get('Controller');

  await deploy('MainVaultMock', {
    from: deployer,
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
func.tags = ['MainVaultMock'];
func.dependencies = ['Swap', 'Controller', 'Game'];
