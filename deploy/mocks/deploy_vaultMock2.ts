import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { vaultDeploySettings } from 'deploySettings';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  run,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao, guardian } = await getNamedAccounts();

  const { name, symbol, decimals, vaultNumber, vaultCurrency, uScale } = vaultDeploySettings;

  const swapLibrary = await deployments.get('Swap');
  const game = await deployments.get('GameMock');
  const controller = await deployments.get('Controller');

  await deploy('Vault2', {
    from: deployer,
    contract: 'MainVaultMock',
    args: [
      name,
      symbol,
      decimals,
      vaultNumber,
      dao,
      game.address,
      controller.address,
      vaultCurrency,
      uScale,
    ],
    libraries: {
      Swap: swapLibrary.address,
    },
    log: true,
    autoMine: true,
  });

  await run('vault_init');
};
export default func;
func.tags = ['Vault2'];
func.dependencies = ['Swap', 'Controller', 'GameMock'];
