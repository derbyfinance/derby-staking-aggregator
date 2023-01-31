import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { usdc } from '@testhelp/addresses';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deploySettings = {
    name: 'YearnVaultMock1',
    symbol: 'YVM',
    decimals: 6,
    vaultCurrency: usdc,
    exchangeRate: 1025000,
  };
  const { name, symbol, decimals, vaultCurrency, exchangeRate } = deploySettings;

  await deploy('YearnVaultMock1', {
    from: deployer,
    contract: 'YearnVaultMock',
    args: [name, symbol, decimals, vaultCurrency, exchangeRate],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['YearnVaultMock1'];
func.dependencies = [];
