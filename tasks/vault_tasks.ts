import { usdc } from '@testhelp/addresses';
import { erc20 } from '@testhelp/helpers';
import { gameDeploySettings } from 'deploySettings';
import { Result } from 'ethers/lib/utils';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('vault_deposit', 'Deposit VaultCurrency to Vault and mint LP tokens')
  .addParam('amount', 'Amount to deposit', null, types.int)
  .setAction(async ({ amount }, hre) => {
    const vault = await getVault(hre);
    const user = await getUser(hre);

    await vault.connect(user).deposit(amount);
  });

const getVault = async ({ deployments, ethers, network }: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const vaultContract = network.name === 'hardhat' ? 'MainVaultMock' : 'MainVault';
  const { address } = await deployments.get(vaultContract);
  const vault = await ethers.getContractAt(vaultContract, address);
  return vault;
};

const getAccounts = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { dao } = await getNamedAccounts();
  return ethers.getSigner(dao);
};

const getGuardian = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { guardian } = await getNamedAccounts();
  return ethers.getSigner(guardian);
};

const getUser = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { user } = await getNamedAccounts();
  return ethers.getSigner(user);
};
