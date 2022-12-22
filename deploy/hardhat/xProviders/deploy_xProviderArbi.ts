import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getDeployConfigXProvider } from '@testhelp/deployHelpers';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const deployConfig = await getDeployConfigXProvider(network.name);
  if (!deployConfig) throw 'Unknown contract name';
  const { arbitrum } = deployConfig;

  const game = await deployments.get('GameMock');
  const xChainController = await deployments.get('XChainControllerMock');
  const LZEndpoint = await deployments.get('LZEndpointArbi');
  const connextHandler = await deployments.get('ConnextHandlerMock');

  await deploy('XProviderArbi', {
    from: deployer,
    contract: 'XProvider',
    args: [
      LZEndpoint.address,
      connextHandler.address,
      dao,
      game.address,
      xChainController.address,
      arbitrum,
    ],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XProviderArbi'];
func.dependencies = ['GameMock', 'XChainControllerMock', 'LZEndpointArbi', 'ConnextHandlerMock'];
