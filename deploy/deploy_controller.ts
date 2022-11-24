import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  run,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  await deploy('Controller', {
    from: deployer,
    args: [dao],
    log: true,
    autoMine: true,
  });

  await run('controller_init');
};
export default func;
func.tags = ['Controller'];
