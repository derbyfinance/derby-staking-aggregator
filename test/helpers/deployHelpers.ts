import { Controller, DerbyToken, GameMock, XProvider } from '@typechain';
import { Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import deployXProviderMain from 'deploy/mocks/deploy_xProviderMain';
import deployXProviderArbi from 'deploy/mocks/deploy_xProviderArbi';
import deployXProviderOpti from 'deploy/mocks/deploy_xProviderOpti';

export async function getController({
  deployments,
  ethers,
}: HardhatRuntimeEnvironment): Promise<Controller> {
  await deployments.fixture(['Controller']);
  const deployment = await deployments.get('Controller');
  const controller = await ethers.getContractAt('Controller', deployment.address);

  return controller;
}

export async function getGame({
  deployments,
  ethers,
}: HardhatRuntimeEnvironment): Promise<GameMock> {
  const deployment = await deployments.get('GameMock');
  const game: GameMock = await ethers.getContractAt('GameMock', deployment.address);

  return game;
}

export async function getDerbyToken({
  deployments,
  ethers,
}: HardhatRuntimeEnvironment): Promise<DerbyToken> {
  const deployment = await deployments.get('DerbyToken');
  const derbyToken: DerbyToken = await ethers.getContractAt('DerbyToken', deployment.address);

  return derbyToken;
}

export async function getContract(
  contractName: string,
  { deployments, ethers }: HardhatRuntimeEnvironment,
): Promise<Contract> {
  const deployment = await deployments.get(contractName);
  const contract = await ethers.getContractAt(contractName, deployment.address);

  return contract;
}

export async function deployAndGetProviders(
  hre: HardhatRuntimeEnvironment,
  xControllerChain: number,
  gameChain: number,
): Promise<XProvider[]> {
  const { deployments, ethers, run } = hre;
  // can only deploy 1 at a time
  await deployXProviderMain(hre);
  await deployXProviderArbi(hre);
  await deployXProviderOpti(hre);

  const [main, arbitrum, optimism] = await Promise.all([
    deployments.get('XProviderMain'),
    deployments.get('XProviderArbi'),
    deployments.get('XProviderOpti'),
  ]);

  const xProviders = await Promise.all([
    ethers.getContractAt('XProvider', main.address),
    ethers.getContractAt('XProvider', arbitrum.address),
    ethers.getContractAt('XProvider', optimism.address),
  ]);

  for (const provider of xProviders) {
    await run('xprovider_init', {
      xProvider: provider,
      controllerProvider: arbitrum.address,
      xControllerChainId: xControllerChain,
      gameChainId: gameChain,
    });
  }

  return [...xProviders];
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
