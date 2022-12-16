import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xProviderDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const { arbitrum } = xProviderDeploySettings;

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
