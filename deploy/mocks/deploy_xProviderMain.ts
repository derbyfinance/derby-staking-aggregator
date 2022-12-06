import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xProviderDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const { layerZeroEndpoint, connextHandler, mainnet } = xProviderDeploySettings;

  const game = await deployments.get('GameMock');
  const xChainController = await deployments.get('XChainControllerMock');

  await deploy('XProviderMain', {
    from: deployer,
    contract: 'XProvider',
    args: [layerZeroEndpoint, connextHandler, dao, game.address, xChainController.address, mainnet],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XProviderMain'];
func.dependencies = ['GameMock', 'XChainControllerMock'];
