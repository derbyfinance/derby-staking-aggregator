import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getDeployConfigXProvider } from '@testhelp/deployHelpers';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deployConfig = await getDeployConfigXProvider(network.name);
  if (!deployConfig) throw 'Unknown contract name';
  const { bnb } = deployConfig;

  await deploy('LZEndpointBnb', {
    from: deployer,
    contract: 'LZEndpointMock',
    args: [bnb],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['LZEndpointBnb'];
