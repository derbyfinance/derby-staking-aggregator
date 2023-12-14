import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  run,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const controllerDeployment = await deploy('Controller', {
    from: deployer,
    contract: 'Controller',
    args: [dao],
    log: true,
    autoMine: true,
  });

  // await new Promise(f => setTimeout(f, 60000));

  // await run(`verify:verify`, {
  //   address: controllerDeployment.address,
  //   constructorArguments: [dao],
  // });
};
export default func;
func.tags = ['Controller'];
