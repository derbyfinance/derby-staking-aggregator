import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { derbyTokenSettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const { name, symbol, totalSupply } = derbyTokenSettings;

  await deploy('DerbyToken', {
    from: deployer,
    args: [name, symbol, ethers.utils.parseEther(totalSupply.toString())],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['DerbyToken'];
