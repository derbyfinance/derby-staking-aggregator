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
  const { bnb } = deployConfig;

  const game = await deployments.get('GameMock');
  const xChainController = await deployments.get('XChainControllerMock');
  const LZEndpoint = await deployments.get('LZEndpointBnb');
  const connext = await deployments.get('ConnextMock');

  await deploy('XProviderBnb', {
    from: deployer,
    contract: 'XProvider',
    args: [
      LZEndpoint.address,
      connext.address,
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
func.dependencies = ['GameMock', 'XChainControllerMock', 'LZEndpointBnb', 'ConnextMock'];
