import { Controller, LZEndpointMock, XProvider } from '@typechain';
import { Contract, Signer } from 'ethers';
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

export async function getContract(
  contractName: string,
  { deployments, ethers }: HardhatRuntimeEnvironment,
): Promise<Contract> {
  const deployment = await deployments.get(contractName);
  const contract = await ethers.getContractAt(contractName, deployment.address);

  return contract;
}

export async function getXProviders(
  hre: HardhatRuntimeEnvironment,
  chains: {
    xController: number;
    game: number;
  },
): Promise<XProvider[]> {
  const { deployments, ethers, run } = hre;

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
      xControllerChainId: chains.xController,
      gameChainId: chains.game,
    });
  }

  return [...xProviders];
}

export async function InitProviders(dao: Signer, xProviders: XProvider[]) {
  const [xProviderMain, xProviderArbi] = xProviders;

  await Promise.all([
    xProviderMain.connect(dao).setTrustedRemote(100, xProviderArbi.address),
    xProviderArbi.connect(dao).setTrustedRemote(10, xProviderMain.address),
  ]);
}

export async function InitEndpoints(hre: HardhatRuntimeEnvironment, xProviders: XProvider[]) {
  const [LZEndpointMain, LZEndpointArbi] = await getEndpoints(hre);
  const [xProviderMain, xProviderArbi] = xProviders;

  await Promise.all([
    LZEndpointMain.setDestLzEndpoint(xProviderArbi.address, LZEndpointArbi.address),
    LZEndpointArbi.setDestLzEndpoint(xProviderMain.address, LZEndpointMain.address),
  ]);
}

export async function getEndpoints(hre: HardhatRuntimeEnvironment): Promise<LZEndpointMock[]> {
  const { deployments, ethers } = hre;

  const [main, arbitrum, optimism] = await Promise.all([
    deployments.get('LZEndpointMain'),
    deployments.get('LZEndpointArbi'),
    deployments.get('LZEndpointOpti'),
  ]);

  const [LZEndpointMain, LZEndpointArbi, LZEndpointOpti] = await Promise.all([
    ethers.getContractAt('LZEndpointMock', main.address),
    ethers.getContractAt('LZEndpointMock', arbitrum.address),
    ethers.getContractAt('LZEndpointMock', optimism.address),
  ]);

  return [LZEndpointMain, LZEndpointArbi, LZEndpointOpti];
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
