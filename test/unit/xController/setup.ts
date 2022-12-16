import { deployments } from 'hardhat';
import { erc20, parseEther, transferAndApproveUSDC } from '@testhelp/helpers';
import type { Controller, DerbyToken, GameMock, XChainControllerMock } from '@typechain';
import { allProtocols, usdc } from '@testhelp/addresses';
import {
  getAndInitXProviders,
  InitController,
  InitEndpoints,
  InitGame,
  InitXController,
} from '@testhelp/InitialiseContracts';
import { vaultDeploySettings } from 'deploySettings';
import { getAllSigners, getContract, getTestVaults } from '@testhelp/getContracts';
import allProvidersClass from '@testhelp/classes/allProvidersClass';

const chainIds = [10, 100, 1000, 10000];

export const setupXChain = deployments.createFixture(async (hre) => {
  const { run } = hre;
  await deployments.fixture([
    'XChainControllerMock',
    'YearnProvider',
    'CompoundProvider',
    'AaveProvider',
    'TruefiProvider',
    'HomoraProvider',
    'IdleProvider',
    'BetaProvider',
    'TestVault1',
    'TestVault2',
    'TestVault3',
    'TestVault4',
    'XProviderMain',
    'XProviderArbi',
    'XProviderOpti',
    'XProviderBnb',
  ]);

  const IUSDc = erc20(usdc);
  const [dao, user, guardian] = await getAllSigners(hre);
  const vaultNumber = 10;

  const game = (await getContract('GameMock', hre)) as GameMock;
  const controller = (await getContract('Controller', hre)) as Controller;
  const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
  const xChainController = (await getContract('XChainControllerMock', hre)) as XChainControllerMock;

  const [vault1, vault2, vault3, vault4] = await getTestVaults(hre);
  const allXProviders = await getAndInitXProviders(hre, dao, { xController: 100, game: 10 });
  const [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb] = allXProviders;

  await Promise.all([
    InitEndpoints(hre, allXProviders),
    InitController(hre),
    InitGame(hre, game, guardian, {
      vaultNumber,
      gameXProvider: xProviderMain.address,
      chainIds,
      homeVault: vault1.address,
    }),
    run('vault_init', { contract: 'TestVault1' }),
    run('vault_init', { contract: 'TestVault2' }),
    run('vault_init', { contract: 'TestVault3' }),
    run('vault_init', { contract: 'TestVault4' }),
    run('vault_set_homexprovider', { contract: 'TestVault1', address: xProviderMain.address }),
    run('vault_set_homexprovider', { contract: 'TestVault2', address: xProviderArbi.address }),
    run('vault_set_homexprovider', { contract: 'TestVault3', address: xProviderOpti.address }),
    run('vault_set_homexprovider', { contract: 'TestVault4', address: xProviderBnb.address }),
    InitXController(hre, xChainController, guardian, dao, {
      vaultNumber,
      chainIds,
      homeXProvider: xProviderArbi.address,
    }),
  ]);

  await Promise.all([
    xProviderMain.connect(dao).toggleVaultWhitelist(vault1.address),
    xProviderArbi.connect(dao).toggleVaultWhitelist(vault2.address),
    xProviderOpti.connect(dao).toggleVaultWhitelist(vault3.address),
    xProviderBnb.connect(dao).toggleVaultWhitelist(vault4.address),

    IUSDc.connect(user).approve(vault1.address, 100_000 * 1e6),
    IUSDc.connect(user).approve(vault2.address, 200_000 * 1e6),
    derbyToken.transfer(user.address, parseEther('2100')),
    transferAndApproveUSDC(vault1.address, user, 10_000_000 * 1e6),

    allProvidersClass.setProviders(hre),
  ]);

  // add all protocol vaults to controller
  for (const protocol of allProtocols.values()) {
    await protocol.addProtocolToController(
      controller,
      dao,
      vaultDeploySettings.vaultNumber,
      allProvidersClass,
    );
  }

  return {
    vault1,
    vault2,
    vault3,
    vault4,
    controller,
    game,
    xChainController,
    derbyToken,
    dao,
    user,
    guardian,
  };
});
