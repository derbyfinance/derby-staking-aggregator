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
    name: 'CompoundVaultMockUSDC',
    symbol: 'CaVM',
    decimals: 8,
    vaultCurrency: usdc,
    exchangeRate: 230000000000000,
  };
  const { name, symbol, decimals, vaultCurrency, exchangeRate } = deploySettings;

  await deploy('CompoundVaultMockUSDC', {
    from: deployer,
    contract: 'CompoundVaultMock',
    args: [name, symbol, decimals, vaultCurrency, exchangeRate],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['CompoundVaultMockUSDC'];
func.dependencies = [];
