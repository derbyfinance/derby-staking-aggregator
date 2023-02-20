import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getDeployConfigXProvider } from '@testhelp/deployHelpers';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao, guardian } = await getNamedAccounts();

  const deployConfig = await getDeployConfigXProvider(network.name);
  if (!deployConfig) throw 'Unknown contract name';
  const { layerZeroEndpoint, connextHandler, mainnet } = deployConfig;

  const game = await deployments.get('Game');
  const xChainController = await deployments.get('XChainController');

  await deploy('XProvider', {
    from: deployer,
    args: [
      layerZeroEndpoint,
      connextHandler,
      dao,
      guardian,
      game.address,
      xChainController.address,
      mainnet,
    ],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XProvider'];
func.dependencies = ['Game', 'XChainController'];
