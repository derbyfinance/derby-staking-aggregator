import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xProviderDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const { arbitrum } = xProviderDeploySettings;

  await deploy('LZEndpointArbi', {
    from: deployer,
    contract: 'LZEndpointMock',
    args: [arbitrum],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['LZEndpointArbi'];
