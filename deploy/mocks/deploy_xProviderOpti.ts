import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xProviderDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const { layerZeroEndpoint, optimism } = xProviderDeploySettings;

  const game = await deployments.get('GameMock');
  const xChainController = await deployments.get('XChainControllerMock');
  const connextHandler = await deployments.get('ConnextHandlerMock');

  await deploy('XProviderOpti', {
    from: deployer,
    contract: 'XProvider',
    args: [
      layerZeroEndpoint,
      connextHandler.address,
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
func.dependencies = ['GameMock', 'XChainControllerMock', 'LZEndpointOpti', 'ConnextHandlerMock'];
