import {
  Controller,
  GameMock,
  LZEndpointMock,
  MainVaultMock,
  XChainController,
  XProvider,
} from '@typechain';
import { gameDeploySettings, gameInitSettings, vaultInitSettings } from 'deploySettings';
import { BigNumberish, Contract, Signer } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { testConnextChainIds, usdc } from './addresses';

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

export async function getTestVaults(hre: HardhatRuntimeEnvironment): Promise<MainVaultMock[]> {
  const { deployments, ethers } = hre;

  const [vault1, vault2, vault3, vault4] = await Promise.all([
    deployments.get('TestVault1'),
    deployments.get('TestVault2'),
    deployments.get('TestVault3'),
    deployments.get('TestVault4'),
  ]);

  const vaults = await Promise.all([
    ethers.getContractAt('MainVaultMock', vault1.address),
    ethers.getContractAt('MainVaultMock', vault2.address),
    ethers.getContractAt('MainVaultMock', vault3.address),
    ethers.getContractAt('MainVaultMock', vault4.address),
  ]);

  return vaults;
}

export async function getXProviders(
  hre: HardhatRuntimeEnvironment,
  dao: Signer,
  chains: {
    xController: number;
    game: number;
  },
): Promise<XProvider[]> {
  const { deployments, ethers, run } = hre;

  const [main, arbitrum, optimism, bnb] = await Promise.all([
    deployments.get('XProviderMain'),
    deployments.get('XProviderArbi'),
    deployments.get('XProviderOpti'),
    deployments.get('XProviderBnb'),
  ]);

  const xProviders = await Promise.all([
    ethers.getContractAt('XProvider', main.address),
    ethers.getContractAt('XProvider', arbitrum.address),
    ethers.getContractAt('XProvider', optimism.address),
    ethers.getContractAt('XProvider', bnb.address),
  ]);

  for (const xProvider of xProviders) {
    await Promise.all([
      xProvider.connect(dao).setXControllerProvider(arbitrum.address),
      xProvider.connect(dao).setXControllerChainId(chains.xController),
      xProvider.connect(dao).setGameChainId(chains.game),
      xProvider.connect(dao).setTrustedRemote(10, main.address),
      xProvider.connect(dao).setTrustedRemote(100, arbitrum.address),
      xProvider.connect(dao).setTrustedRemote(1000, optimism.address),
      xProvider.connect(dao).setTrustedRemote(10000, bnb.address),
      xProvider.connect(dao).setConnextChainId(10, testConnextChainIds.goerli),
      xProvider.connect(dao).setConnextChainId(100, testConnextChainIds.mumbai),
      xProvider.connect(dao).setConnextChainId(1000, testConnextChainIds.optimismGoerli),
    ]);
  }

  return [...xProviders];
}

export async function InitXController(
  xController: XChainController,
  guardian: Signer,
  dao: Signer,
  info: {
    vaultNumber: BigNumberish;
    chainIds: BigNumberish[];
    homeXProvider: string;
    chainVault: string;
  },
) {
  const { vaultNumber, chainIds, homeXProvider, chainVault } = info;

  await Promise.all([
    xController.connect(guardian).setChainIds(chainIds),
    xController.connect(dao).setHomeXProvider(homeXProvider),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 10, chainVault, usdc),
  ]);
}

export async function InitVault(
  { run }: HardhatRuntimeEnvironment,
  vault: MainVaultMock,
  guardian: Signer,
  dao: Signer,
  info: {
    homeXProvider: string;
    homeChain: number;
  },
) {
  const { gasFeeLiq, rebalanceInterval, marginScale, liquidityPercentage, performanceFee } =
    vaultInitSettings;

  const guardianAddr = await guardian.getAddress();
  const { homeXProvider, homeChain } = info;

  await vault.connect(dao).setGuardian(guardianAddr);

  await Promise.all([
    vault.connect(dao).setHomeXProvider(homeXProvider),
    vault.connect(dao).setPerformanceFee(performanceFee),
    vault.connect(dao).setSwapRewards(true),
    vault.connect(guardian).setHomeChain(homeChain),
    vault.connect(guardian).setGasFeeLiquidity(gasFeeLiq),
    vault.connect(guardian).setRebalanceInterval(rebalanceInterval),
    vault.connect(guardian).setMarginScale(marginScale),
    vault.connect(guardian).setLiquidityPerc(liquidityPercentage),
  ]);
}

export async function InitGame(
  { run, deployments }: HardhatRuntimeEnvironment,
  game: GameMock,
  guardian: Signer,
  info: {
    vaultNumber: number;
    gameXProvider: string;
    chainIds: BigNumberish[];
  },
) {
  const { negativeRewardThreshold, negativeRewardFactor } = gameDeploySettings;
  const { latestprotocolid } = gameInitSettings;
  const { vaultNumber, chainIds, gameXProvider } = info;

  await Promise.all([
    run('game_set_negative_reward_factor', { factor: negativeRewardFactor }),
    run('game_set_negative_reward_threshold', { threshold: negativeRewardThreshold }),
    run('game_set_chain_ids', { chainids: chainIds }),
    run('game_latest_protocol_id', { chainid: chainIds[0], latestprotocolid }),
    run('game_latest_protocol_id', { chainid: chainIds[1], latestprotocolid }),
    run('game_latest_protocol_id', { chainid: chainIds[2], latestprotocolid }),
    run('game_latest_protocol_id', { chainid: chainIds[3], latestprotocolid }),
    run('game_set_xprovider', { provider: gameXProvider }),
  ]);

  const [vault1, vault2, vault3, vault4] = await Promise.all([
    deployments.get('TestVault1'),
    deployments.get('TestVault2'),
    deployments.get('TestVault3'),
    deployments.get('TestVault4'),
  ]);

  await Promise.all([
    game.connect(guardian).setVaultAddress(vaultNumber, chainIds[0], vault1.address),
    game.connect(guardian).setVaultAddress(vaultNumber, chainIds[1], vault2.address),
    game.connect(guardian).setVaultAddress(vaultNumber, chainIds[2], vault3.address),
    game.connect(guardian).setVaultAddress(vaultNumber, chainIds[3], vault4.address),
  ]);
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

export async function InitEndpoints(hre: HardhatRuntimeEnvironment, xProviders: XProvider[]) {
  const [LZEndpointMain, LZEndpointArbi, LZEndpointOpti, LZEndpointBnb] = await getEndpoints(hre);
  const [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb] = xProviders;

  await Promise.all([
    LZEndpointMain.setDestLzEndpoint(xProviderArbi.address, LZEndpointArbi.address),
    LZEndpointMain.setDestLzEndpoint(xProviderOpti.address, LZEndpointOpti.address),
    LZEndpointMain.setDestLzEndpoint(xProviderBnb.address, LZEndpointBnb.address),
    LZEndpointArbi.setDestLzEndpoint(xProviderMain.address, LZEndpointMain.address),
    LZEndpointArbi.setDestLzEndpoint(xProviderOpti.address, LZEndpointOpti.address),
    LZEndpointArbi.setDestLzEndpoint(xProviderBnb.address, LZEndpointBnb.address),
    LZEndpointOpti.setDestLzEndpoint(xProviderMain.address, LZEndpointMain.address),
    LZEndpointOpti.setDestLzEndpoint(xProviderArbi.address, LZEndpointArbi.address),
    LZEndpointOpti.setDestLzEndpoint(xProviderBnb.address, LZEndpointBnb.address),
    LZEndpointBnb.setDestLzEndpoint(xProviderMain.address, LZEndpointMain.address),
    LZEndpointBnb.setDestLzEndpoint(xProviderArbi.address, LZEndpointArbi.address),
    LZEndpointBnb.setDestLzEndpoint(xProviderOpti.address, LZEndpointOpti.address),
  ]);
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
