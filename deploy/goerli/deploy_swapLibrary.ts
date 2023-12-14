import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const swaplibraryDeployment = await deploy('Swap', {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  // await new Promise(f => setTimeout(f, 60000));

  // await run(`verify:verify`, {
  //   address: swaplibraryDeployment.address,
  //   constructorArguments: [],
  // });
};
export default func;
func.tags = ['Swap'];
