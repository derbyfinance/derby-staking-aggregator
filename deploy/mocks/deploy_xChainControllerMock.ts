import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { xChainControllerDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao, guardian } = await getNamedAccounts();

  const { homeChainId } = xChainControllerDeploySettings;

  const game = await deployments.get('Game');

  await deploy('XChainControllerMock', {
    from: deployer,
    args: [game.address, dao, guardian, homeChainId],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XChainControllerMock'];
func.dependencies = ['Game'];
