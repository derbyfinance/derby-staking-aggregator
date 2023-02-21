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
  const { mainnet } = deployConfig;

  const game = await deployments.get('GameMock');
  const xChainController = await deployments.get('XChainControllerMock');
  const connext = await deployments.get('ConnextMock');

  await deploy('XProviderMain', {
    from: deployer,
    contract: 'XProvider',
    args: [
      connext.address,
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
func.dependencies = ['GameMock', 'XChainControllerMock', 'ConnextMock'];
