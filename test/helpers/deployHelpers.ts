import { Controller } from '@typechain';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

export async function getController({
  deployments,
  ethers,
}: HardhatRuntimeEnvironment): Promise<Controller> {
  await deployments.fixture(['Controller']);
  const deployment = await deployments.get('Controller');
  const controller = await ethers.getContractAt('Controller', deployment.address);

  return controller;
}

export async function getAllSigners({ getNamedAccounts, ethers }: HardhatRuntimeEnvironment) {
  const accounts = await getNamedAccounts();
  const [deployer, dao, guardian, user, vault] = await Promise.all([
    ethers.getSigner(accounts.deployer),
    ethers.getSigner(accounts.dao),
    ethers.getSigner(accounts.guardian),
    ethers.getSigner(accounts.user),
    ethers.getSigner(accounts.vault),
  ]);
  return { deployer, dao, guardian, user, vault };
}
