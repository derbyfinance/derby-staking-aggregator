import { Controller, LZEndpointMock, MainVaultMock, XChainController, XProvider } from '@typechain';
import { vaultInitSettings } from 'deploySettings';
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

export async function getXProviders(
  hre: HardhatRuntimeEnvironment,
  dao: Signer,
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

  for (const xProvider of xProviders) {
    await Promise.all([
      xProvider.connect(dao).setXControllerProvider(arbitrum.address),
      xProvider.connect(dao).setXControllerChainId(chains.xController),
      xProvider.connect(dao).setGameChainId(chains.game),
      xProvider.connect(dao).setTrustedRemote(10, main.address),
      xProvider.connect(dao).setTrustedRemote(100, arbitrum.address),
      xProvider.connect(dao).setTrustedRemote(1000, optimism.address),
      xProvider.connect(dao).setConnextChainId(10, testConnextChainIds.goerli),
      xProvider.connect(dao).setConnextChainId(100, testConnextChainIds.mumbai),
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
    run('vault_set_gas_fee_liq', { liquidity: gasFeeLiq }),
    run('vault_set_rebalance_interval', { timestamp: rebalanceInterval }),
    run('vault_set_margin_scale', { scale: marginScale }),
    run('vault_set_liquidity_perc', { percentage: liquidityPercentage }),
    run('vault_set_performance_fee', { percentage: performanceFee }),
    run('vault_set_swap_rewards', { state: true }),
  ]);

  await Promise.all([
    vault.connect(dao).setHomeXProvider(homeXProvider),
    vault.connect(guardian).setHomeChain(homeChain),
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
