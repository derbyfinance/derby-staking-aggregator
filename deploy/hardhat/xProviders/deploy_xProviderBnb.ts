import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xProviderDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const { bnb } = xProviderDeploySettings;

  const game = await deployments.get('GameMock');
  const xChainController = await deployments.get('XChainControllerMock');
  const LZEndpoint = await deployments.get('LZEndpointBnb');
  const connextHandler = await deployments.get('ConnextHandlerMock');

  await deploy('XProviderBnb', {
    from: deployer,
    contract: 'XProvider',
    args: [
      LZEndpoint.address,
      connextHandler.address,
      dao,
      game.address,
      xChainController.address,
      bnb,
    ],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XProviderBnb'];
func.dependencies = ['GameMock', 'XChainControllerMock', 'LZEndpointBnb', 'ConnextHandlerMock'];
