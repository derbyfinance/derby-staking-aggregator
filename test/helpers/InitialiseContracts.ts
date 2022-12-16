import { GameMock, MainVaultMock, XChainController, XProvider } from '@typechain';
import { gameDeploySettings, gameInitSettings, vaultInitSettings } from 'deploySettings';
import { BigNumberish, Signer } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { testConnextChainIds, usdc } from './addresses';
import { getEndpoints, getTestVaultDeployments } from './getContracts';

export async function getAndInitXProviders(
  hre: HardhatRuntimeEnvironment,
  dao: Signer,
  chains: {
    xController: number;
    game: number;
  },
): Promise<XProvider[]> {
  const { deployments, ethers } = hre;

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
  { deployments }: HardhatRuntimeEnvironment,
  xController: XChainController,
  guardian: Signer,
  dao: Signer,
  info: {
    vaultNumber: BigNumberish;
    chainIds: BigNumberish[];
    homeXProvider: string;
  },
) {
  const { vaultNumber, chainIds, homeXProvider } = info;

  const [vault1, vault2, vault3, vault4] = await getTestVaultDeployments(deployments);

  await Promise.all([
    xController.connect(guardian).setChainIds(chainIds),
    xController.connect(dao).setHomeXProvider(homeXProvider),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 10, vault1.address, usdc),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 100, vault2.address, usdc),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 1000, vault3.address, usdc),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 10000, vault4.address, usdc),
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
    homeVault: string;
  },
) {
  const { negativeRewardThreshold, negativeRewardFactor } = gameDeploySettings;
  const { latestprotocolid } = gameInitSettings;
  const { vaultNumber, chainIds, gameXProvider, homeVault } = info;

  await Promise.all([
    run('game_set_negative_reward_factor', { factor: negativeRewardFactor }),
    run('game_set_negative_reward_threshold', { threshold: negativeRewardThreshold }),
    run('game_set_chain_ids', { chainids: chainIds }),
    run('game_set_xprovider', { provider: gameXProvider }),
    run('game_set_home_vault', { vault: homeVault }),
  ]);

  const vaults = await getTestVaultDeployments(deployments);

  for (let i = 0; i < chainIds.length; i++) {
    await run('game_latest_protocol_id', { chainid: chainIds[i], latestprotocolid });
    game.connect(guardian).setVaultAddress(vaultNumber, chainIds[i], vaults[i].address);
  }
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

export async function InitController({ run, deployments }: HardhatRuntimeEnvironment) {
  const vaults = await getTestVaultDeployments(deployments);

  await run('controller_init');

  for (const vault of vaults) {
    await run('controller_add_vault', { vault: vault.address });
  }
}
