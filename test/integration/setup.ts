import { deployments } from 'hardhat';
import { erc20, parseDRB, parseEther, transferAndApproveUSDC } from '@testhelp/helpers';
import type { Controller, DerbyToken, GameMock, XChainControllerMock } from '@typechain';
import { allProtocols, usdc } from '@testhelp/addresses';
import {
  getAndInitXProviders,
  AddAllVaultsToController as addVaultsToController,
  InitEndpoints,
  setGameLatestProtocolIds,
  addVaultsToXController,
  setWhitelistVaults,
} from '@testhelp/InitialiseContracts';
import { getAllSigners, getContract, getTestVaults } from '@testhelp/getContracts';
import allProvidersClass from '@testhelp/classes/allProvidersClass';
import { allNamedAccountsToSigners } from './helpers';

const chainids = [10, 100, 1000, 10000];

export const setupIntegration = deployments.createFixture(async (hre) => {
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
  // const [dao, user, user2, user3, gameUser1, gameUser2, gameUser3, guardian] = await getAllSigners(
  //   hre,
  // );
  const [dao, guardian, user, user2, user3, gameUser1, gameUser2, gameUser3] =
    await allNamedAccountsToSigners(hre);
  const vaultNumber = 10;

  const game = (await getContract('GameMock', hre)) as GameMock;
  const controller = (await getContract('Controller', hre)) as Controller;
  const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
  const xChainController = (await getContract('XChainControllerMock', hre)) as XChainControllerMock;

  const [vault1, vault2, vault3, vault4] = await getTestVaults(hre);
  const vaults = { 1: vault1, 2: vault2, 3: vault3, 4: vault4 };
  const users = { 1: user, 2: user2, 3: user3 };
  const gameUsers = { 1: gameUser1, 2: gameUser2, 3: gameUser3 };
  const allXProviders = await getAndInitXProviders(hre, dao, { xController: 10, game: 10 });
  const [xProviderMain, xProviderArbi] = allXProviders;

  await Promise.all([
    run('controller_init'),

    run('game_init', { provider: xProviderMain.address, homevault: vault1.address, chainids }),

    run('vault_init', { contract: 'TestVault1' }),
    run('vault_init', { contract: 'TestVault2' }),

    run('vault_set_homexprovider', { contract: 'TestVault1', address: xProviderMain.address }),
    run('vault_set_homexprovider', { contract: 'TestVault2', address: xProviderArbi.address }),

    run('xcontroller_init', { chainids, homexprovider: xProviderMain.address }),
  ]);

  await Promise.all([
    setWhitelistVaults(hre, allXProviders, dao),
    InitEndpoints(hre, allXProviders),
    addVaultsToController(hre),
    addVaultsToXController(hre, xChainController, dao, vaultNumber),
    setGameLatestProtocolIds(hre, { vaultNumber, latestId: 5, chainids }),

    IUSDc.connect(user).approve(vault1.address, 100_000 * 1e6),
    IUSDc.connect(user).approve(vault2.address, 200_000 * 1e6),
    derbyToken.transfer(user.address, parseDRB(2100)),
    derbyToken.transfer(user2.address, parseDRB(10_000)),
    derbyToken.transfer(user3.address, parseDRB(100_000)),
    transferAndApproveUSDC(vault1.address, user, 10_000_000 * 1e6),

    allProvidersClass.setProviders(hre),
  ]);

  // add all protocol vaults to controller
  for (const protocol of allProtocols.values()) {
    await protocol.addProtocolToController(controller, dao, vaultNumber, allProvidersClass);
  }

  return {
    vaults,
    controller,
    game,
    xChainController,
    derbyToken,
    dao,
    users,
    gameUsers,
    guardian,
  };
});
