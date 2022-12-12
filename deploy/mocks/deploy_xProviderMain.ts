import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xProviderDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const { mainnet } = xProviderDeploySettings;

  const game = await deployments.get('GameMock');
  const xChainController = await deployments.get('XChainControllerMock');
  const LZEndpoint = await deployments.get('LZEndpointMain');
  const connextHandler = await deployments.get('ConnextHandlerMock');

  await deploy('XProviderMain', {
    from: deployer,
    contract: 'XProvider',
    args: [
      LZEndpoint.address,
      connextHandler.address,
      dao,
      game.address,
      xChainController.address,
      mainnet,
    ],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XProviderMain'];
func.dependencies = ['GameMock', 'XChainControllerMock', 'LZEndpointMain', 'ConnextHandlerMock'];
