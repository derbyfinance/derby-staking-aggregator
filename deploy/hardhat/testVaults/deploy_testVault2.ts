import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getDeployConfigVault } from '@testhelp/deployHelpers';

const vaultName = 'TestVault2';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const deployConfig = await getDeployConfigVault(vaultName, network.name);
  if (!deployConfig) throw 'Unknown contract name';

  const { name, symbol, decimals, vaultNumber, vaultCurrency, nativeToken, minScale } = deployConfig;

  const swapLibrary = await deployments.get('Swap');
  const controller = await deployments.get('Controller');

  await deploy(vaultName, {
    from: deployer,
    contract: 'VaultMock',
    args: [
      name,
      symbol,
      decimals,
      vaultNumber,
      dao,
      controller.address,
      vaultCurrency,
      nativeToken,
      minScale
    ],
    libraries: {
      Swap: swapLibrary.address,
    },
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = [vaultName];
func.dependencies = ['Swap', 'Controller'];
