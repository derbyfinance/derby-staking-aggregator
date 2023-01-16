import { deployments } from 'hardhat';
import { erc20, parseDRB, parseEther, transferAndApproveUSDC } from '@testhelp/helpers';
import type { Controller, DerbyToken, GameMock, XChainControllerMock } from '@typechain';
import {
  aave_usdc_01,
  aave_usdt_01,
  allProtocols,
  compound_dai_01,
  compound_usdc_01,
  usdc,
  yearn_usdc_01,
} from '@testhelp/addresses';
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
import { ProtocolVault } from '@testhelp/classes/protocolVaultClass';

const chainids = [10, 100];

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
  const [dao, guardian, user, user1, user2, gameUser0, gameUser1] = await allNamedAccountsToSigners(
    hre,
  );
  const vaultNumber = 10;

  const game = (await getContract('GameMock', hre)) as GameMock;
  const controller = (await getContract('Controller', hre)) as Controller;
  const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
  const xChainController = (await getContract('XChainControllerMock', hre)) as XChainControllerMock;

  const [vault1, vault2] = await getTestVaults(hre);
  const vaults = [vault1, vault2];
  const users = [user, user1, user2];
  const gameUsers = [gameUser0, gameUser1];
  const allXProviders = await getAndInitXProviders(hre, dao, { xController: 100, game: 10 });
  const [xProviderMain, xProviderArbi] = allXProviders;

  await Promise.all([
    run('controller_init'),

    run('game_init', { provider: xProviderMain.address, homevault: vault1.address, chainids }),

    run('vault_init', { contract: 'TestVault1' }),
    run('vault_init', { contract: 'TestVault2' }),

    run('vault_set_homexprovider', { contract: 'TestVault1', address: xProviderMain.address }),
    run('vault_set_homexprovider', { contract: 'TestVault2', address: xProviderArbi.address }),

    run('xcontroller_init', { chainids, homexprovider: xProviderArbi.address }),
  ]);

  await Promise.all([
    setWhitelistVaults(hre, allXProviders, dao),
    InitEndpoints(hre, allXProviders),
    addVaultsToController(hre),
    addVaultsToXController(hre, xChainController, dao, vaultNumber),
    setGameLatestProtocolIds(hre, { vaultNumber, latestId: 5, chainids }),

    IUSDc.connect(user).approve(vault1.address, 100_000 * 1e6),
    IUSDc.connect(user).approve(vault2.address, 200_000 * 1e6),

    derbyToken.transfer(gameUser0.address, parseDRB(10_000)),
    derbyToken.transfer(gameUser1.address, parseDRB(10_000)),

    transferAndApproveUSDC(vault1.address, user, 1_000_000 * 1e6),
    transferAndApproveUSDC(vault1.address, user1, 1_000_000 * 1e6),
    transferAndApproveUSDC(vault2.address, user2, 1_000_000 * 1e6),

    allProvidersClass.setProviders(hre),
  ]);

  const protocols = new Map<string, ProtocolVault>()
    .set('compound_usdc_01', compound_usdc_01)
    .set('aave_usdc_01', aave_usdc_01)
    .set('yearn_usdc_01', yearn_usdc_01)
    .set('compound_dai_01', compound_dai_01)
    .set('aave_usdt_01', aave_usdt_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;
  const compoundDAIVault = protocols.get('compound_dai_01')!;
  const aaveUSDTVault = protocols.get('aave_usdt_01')!;

  // add all protocol vaults to controller
  for (const protocol of protocols.values()) {
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
