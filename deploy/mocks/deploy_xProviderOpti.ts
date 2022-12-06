import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xProviderDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const { layerZeroEndpoint, connextHandler, optimism } = xProviderDeploySettings;

  const game = await deployments.get('GameMock');
  const xChainController = await deployments.get('XChainControllerMock');

  await deploy('XProviderOpti', {
    from: deployer,
    contract: 'XProvider',
    args: [
      layerZeroEndpoint,
      connextHandler,
      dao,
      game.address,
      xChainController.address,
      optimism,
    ],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XProviderOpti'];
func.dependencies = ['GameMock', 'XChainControllerMock'];
