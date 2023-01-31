import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { usdt } from '@testhelp/addresses';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deploySettings = {
    name: 'CompoundVaultMockUSDT',
    symbol: 'CVM',
    decimals: 6,
    vaultCurrency: usdt,
    exchangeRate: 223000000000000,
  };
  const { name, symbol, decimals, vaultCurrency, exchangeRate } = deploySettings;

  await deploy('CompoundVaultMockUSDT', {
    from: deployer,
    contract: 'CompoundVaultMock',
    args: [name, symbol, decimals, vaultCurrency, exchangeRate],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['CompoundVaultMockUSDT'];
func.dependencies = [];
