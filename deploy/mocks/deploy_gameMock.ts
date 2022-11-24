import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { gameDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao, guardian } = await getNamedAccounts();

  const { nftName, nftSymbol } = gameDeploySettings;

  const derbyToken = await deployments.get('DerbyToken');
  const controller = await deployments.get('Controller');

  console.log('deploying mock');

  await deploy('GameMock', {
    from: deployer,
    args: [nftName, nftSymbol, derbyToken.address, dao, guardian, controller.address],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['GameMock'];
func.dependencies = ['DerbyToken', 'Controller'];
