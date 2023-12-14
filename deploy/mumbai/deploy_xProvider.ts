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
  const { connextHandler, mainnet } = deployConfig;

  const game = await deployments.get('Game');

  const xproviderDeployment = await deploy('XProvider', {
    from: deployer,
    args: [connextHandler, dao, guardian, game.address, mainnet],
    log: true,
    autoMine: true,
  });

  // await new Promise(f => setTimeout(f, 60000));

  // await run(`verify:verify`, {
  //   address: xproviderDeployment.address,
  //   constructorArguments: [connextHandler, dao, guardian, game.address, mainnet],
  // });
};
export default func;
func.tags = ['XProviderMumbai'];
func.dependencies = ['Game'];
