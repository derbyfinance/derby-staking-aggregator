import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { controllerDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const { curve3Pool, uniswapRouter, uniswapQuoter, poolFee, ChainlinkGasPrice } =
    controllerDeploySettings;

  await deploy('Controller', {
    from: deployer,
    args: [dao, curve3Pool, uniswapRouter, uniswapQuoter, poolFee, ChainlinkGasPrice],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['Controller'];
