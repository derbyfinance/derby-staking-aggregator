import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { usdc, usdt } from '@testhelp/addresses';

const name: string = 'YearnMockUSDC3';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deploySettings = {
    symbol: 'YVM',
    decimals: 6,
    vaultCurrency: usdc,
    exchangeRate: 1100000,
  };
  const { symbol, decimals, vaultCurrency, exchangeRate } = deploySettings;

  await deploy(name, {
    from: deployer,
    contract: 'YearnVaultMock',
    args: [name, symbol, decimals, vaultCurrency, exchangeRate],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = [name];
func.dependencies = [];
