import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xProviderDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const { layerZeroEndpoint, connextHandler, mainnet } = xProviderDeploySettings;

  const game = await deployments.get('Game');
  const xChainController = await deployments.get('XChainController');

  await deploy('XProvider', {
    from: deployer,
    args: [layerZeroEndpoint, connextHandler, dao, game.address, xChainController.address, mainnet],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XProvider'];
func.dependencies = ['Game', 'XChainController'];
