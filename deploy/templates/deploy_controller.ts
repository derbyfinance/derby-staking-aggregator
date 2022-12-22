import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  run,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  await deploy('TEMPLATEController', {
    from: deployer,
    args: [dao],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['TEMPLATEController'];
