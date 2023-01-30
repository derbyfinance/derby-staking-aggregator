import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { dai } from '@testhelp/addresses';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deploySettings = {
    name: 'CompoundVaultMockDAI',
    symbol: 'CVM',
    decimals: 8,
    vaultCurrency: dai,
    exchangeRate: ethers.utils.parseEther('222000000'),
  };
  const { name, symbol, decimals, vaultCurrency, exchangeRate } = deploySettings;

  await deploy('CompoundVaultMockDAI', {
    from: deployer,
    contract: 'CompoundVaultMock',
    args: [name, symbol, decimals, vaultCurrency, exchangeRate],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['CompoundVaultMockDAI'];
func.dependencies = [];
