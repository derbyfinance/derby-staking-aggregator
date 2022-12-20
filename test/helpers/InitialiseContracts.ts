import { GameMock, XChainController, XProvider } from '@typechain';
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

export async function setWhitelistVaults(
  { deployments }: HardhatRuntimeEnvironment,
  allXProviders: XProvider[],
  dao: Signer,
) {
  const [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb] = allXProviders;
  const [vault1, vault2, vault3, vault4] = await getTestVaultDeployments(deployments);

  await Promise.all([
    xProviderMain.connect(dao).toggleVaultWhitelist(vault1.address),
    xProviderArbi.connect(dao).toggleVaultWhitelist(vault2.address),
    xProviderOpti.connect(dao).toggleVaultWhitelist(vault3.address),
    xProviderBnb.connect(dao).toggleVaultWhitelist(vault4.address),
  ]);
}

export async function addVaultsToXController(
  { deployments }: HardhatRuntimeEnvironment,
  xController: XChainController,
  dao: Signer,
  vaultNumber: number | BigNumberish,
) {
  const [vault1, vault2, vault3, vault4] = await getTestVaultDeployments(deployments);

  await Promise.all([
    xController.connect(dao).setVaultChainAddress(vaultNumber, 10, vault1.address, usdc),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 100, vault2.address, usdc),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 1000, vault3.address, usdc),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 10000, vault4.address, usdc),
  ]);
}

export async function setGameLatestProtocolIds(
  { run, deployments }: HardhatRuntimeEnvironment,
  info: {
    vaultNumber: number;
    latestId: number;
    chainids: BigNumberish[];
  },
) {
  const { vaultNumber, chainids, latestId } = info;

  const vaults = await getTestVaultDeployments(deployments);

  for (let i = 0; i < chainids.length; i++) {
    await run('game_latest_protocol_id', { chainid: chainids[i], latestprotocolid: latestId });
    await run('game_set_vault_address', {
      vaultnumber: vaultNumber,
      chainid: chainids[i],
      address: vaults[i].address,
    });
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

export async function AddAllVaultsToController({ run, deployments }: HardhatRuntimeEnvironment) {
  const vaults = await getTestVaultDeployments(deployments);

  for (const vault of vaults) {
    await run('controller_add_vault', { vault: vault.address });
  }
}
