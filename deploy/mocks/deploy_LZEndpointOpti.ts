import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xProviderDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const { optimism } = xProviderDeploySettings;

  await deploy('LZEndpointOpti', {
    from: deployer,
    contract: 'LZEndpointMock',
    args: [optimism],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['LZEndpointOpti'];
