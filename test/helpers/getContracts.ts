import { Controller, LZEndpointMock, MainVaultMock } from '@typechain';
import { Contract } from 'ethers';
import { Deployment, DeploymentsExtension } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

export async function getContract(
  contractName: string,
  { deployments, ethers }: HardhatRuntimeEnvironment,
  contractType?: string,
): Promise<Contract> {
  const deployment = await deployments.get(contractName);
  const contract = await ethers.getContractAt(
    contractType ? contractType : contractName,
    deployment.address,
  );

  return contract;
}

export async function getTestVaultDeployments(
  deployments: DeploymentsExtension,
): Promise<Deployment[]> {
  const vaults = await Promise.all([
    deployments.get('TestVault1'),
    deployments.get('TestVault2'),
    deployments.get('TestVault3'),
    deployments.get('TestVault4'),
  ]);

  return vaults;
}

export async function getTestVaults(hre: HardhatRuntimeEnvironment): Promise<MainVaultMock[]> {
  const { deployments, ethers } = hre;

  const [vault1, vault2, vault3, vault4] = await getTestVaultDeployments(deployments);

  const vaults = await Promise.all([
    ethers.getContractAt('MainVaultMock', vault1.address),
    ethers.getContractAt('MainVaultMock', vault2.address),
    ethers.getContractAt('MainVaultMock', vault3.address),
    ethers.getContractAt('MainVaultMock', vault4.address),
  ]);

  return vaults;
}

export async function getEndpoints(hre: HardhatRuntimeEnvironment): Promise<LZEndpointMock[]> {
  const { deployments, ethers } = hre;

  const [main, arbitrum, optimism, bnb] = await Promise.all([
    deployments.get('LZEndpointMain'),
    deployments.get('LZEndpointArbi'),
    deployments.get('LZEndpointOpti'),
    deployments.get('LZEndpointBnb'),
  ]);

  const endpoints = await Promise.all([
    ethers.getContractAt('LZEndpointMock', main.address),
    ethers.getContractAt('LZEndpointMock', arbitrum.address),
    ethers.getContractAt('LZEndpointMock', optimism.address),
    ethers.getContractAt('LZEndpointMock', bnb.address),
  ]);

  return endpoints;
}

export async function getAllSigners({ getNamedAccounts, ethers }: HardhatRuntimeEnvironment) {
  const accounts = await getNamedAccounts();
  return Promise.all([
    ethers.getSigner(accounts.dao),
    ethers.getSigner(accounts.user),
    ethers.getSigner(accounts.guardian),
    ethers.getSigner(accounts.vault),
    ethers.getSigner(accounts.deployer),
  ]);
}

export async function deployCompoundMockVaults({ ethers, deployments }: HardhatRuntimeEnvironment) {
  const [vault1, vault2, vault3, vault4, vault5] = await Promise.all([
    deployments.get('YearnVaultMock1'),
    deployments.get('YearnVaultMock2'),
    deployments.get('CompoundVaultMockUSDC'),
    deployments.get('CompoundVaultMockDAI'),
    deployments.get('CompoundVaultMockUSDT'),
  ]);

  const deployedVaults = await Promise.all([
    ethers.getContractAt('YearnVaultMock', vault1.address),
    ethers.getContractAt('YearnVaultMock', vault2.address),
    ethers.getContractAt('CompoundVaultMock', vault3.address),
    ethers.getContractAt('CompoundVaultMock', vault4.address),
    ethers.getContractAt('CompoundVaultMock', vault5.address),
  ]);

  return deployedVaults;
}
