import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getDeployConfigGame } from '@testhelp/deployHelpers';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao, guardian } = await getNamedAccounts();

  const deployConfig = await getDeployConfigGame(network.name);
  if (!deployConfig) throw 'Unknown contract name';

  const { nftName, nftSymbol } = deployConfig;

  const derbyToken = await deployments.get('DerbyToken');

  await deploy('GameMock', {
    from: deployer,
    args: [nftName, nftSymbol, derbyToken.address, dao, guardian],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['GameMock'];
func.dependencies = ['DerbyToken'];
