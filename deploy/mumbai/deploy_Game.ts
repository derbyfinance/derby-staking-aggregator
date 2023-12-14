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

  const gameDeployment = await deploy('Game', {
    from: deployer,
    args: [nftName, nftSymbol, derbyToken.address, dao, guardian],
    log: true,
    autoMine: true,
  });

  // await new Promise(f => setTimeout(f, 60000));

  // await run(`verify:verify`, {
  //   address: gameDeployment.address,
  //   constructorArguments: [nftName, nftSymbol, derbyToken.address, dao, guardian],
  // });
};
export default func;
func.tags = ['Game'];
func.dependencies = ['DerbyToken'];
