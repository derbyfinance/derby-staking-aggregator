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
  const { bnb } = deployConfig;

  const game = await deployments.get('GameMock');
  const connext = await deployments.get('ConnextMock');

  await deploy('XProviderBnb', {
    from: deployer,
    contract: 'XProvider',
    args: [
      connext.address,
      dao,
      guardian,
      game.address,
      bnb,
    ],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XProviderBnb'];
func.dependencies = ['GameMock', 'XChainControllerMock', 'ConnextMock'];
