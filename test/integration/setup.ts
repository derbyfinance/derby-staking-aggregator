import hre, { network } from 'hardhat';
import { erc20, parseDRB, parseEther, transferAndApproveUSDC } from '@testhelp/helpers';
import type {
  CompoundVaultMock,
  Controller,
  DerbyToken,
  GameMock,
  XChainControllerMock,
  YearnVaultMock,
} from '@typechain';
import { compToken, dai, usdc, usdt, yearn, yearn_usdc_01 } from '@testhelp/addresses';
import {
  getAndInitXProviders,
  AddAllVaultsToController as addVaultsToController,
  InitEndpoints,
  setGameLatestProtocolIds,
  addVaultsToXController,
  setWhitelistVaults,
} from '@testhelp/InitialiseContracts';
import {
  deployCompoundMockVaults,
  getAllSigners,
  getContract,
  getTestVaults,
} from '@testhelp/getContracts';
import allProvidersClass from '@testhelp/classes/allProvidersClass';
import { allNamedAccountsToSigners } from './helpers';
import { ProtocolVault } from '@testhelp/classes/protocolVaultClass';

const chainids = [10, 100];

export const setupIntegration = async () => {
  const { run, deployments } = hre;
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
    'YearnMockUSDC1',
    'YearnMockUSDC2',
    'YearnMockDAI1',
    'YearnMockDAI2',
    'YearnMockUSDT1',
  ]);

  const IUSDc = erc20(usdc);
  const [dao, guardian, user, user1, user2, gameUser0, gameUser1] = await allNamedAccountsToSigners(
    hre,
  );
  const vaultNumber = 10;

  const game = (await getContract('GameMock', hre)) as GameMock;
  const controller = (await getContract('Controller', hre)) as Controller;
  const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
  const xChainController = (await getContract('XChainControllerMock', hre)) as XChainControllerMock;

  const [yearn1, yearn2, yearn3, yearn4, yearn5] = await deployCompoundMockVaults(hre);

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

    transferAndApproveUSDC(vault1.address, user, 10_000_000 * 1e6),
    transferAndApproveUSDC(vault1.address, user1, 10_000_000 * 1e6),
    transferAndApproveUSDC(vault2.address, user2, 10_000_000 * 1e6),

    allProvidersClass.setProviders(hre),
  ]);

  const yearn_vault_usdc1 = new ProtocolVault({
    name: 'yearn_mock_vault',
    protocolToken: yearn1.address,
    underlyingToken: usdc,
    govToken: yearn,
    decimals: 6,
    chainId: 1,
  });
  const yearn_vault_usdc2 = new ProtocolVault({
    name: 'yearn_mock_vault2',
    protocolToken: yearn2.address,
    underlyingToken: usdc,
    govToken: yearn,
    decimals: 6,
    chainId: 1,
  });
  const yearn_vault_dai1 = new ProtocolVault({
    name: 'yearn_mock_vault2',
    protocolToken: yearn3.address,
    underlyingToken: dai,
    govToken: yearn,
    decimals: 18,
    chainId: 1,
  });
  const yearn_vault_dai2 = new ProtocolVault({
    name: 'yearn_mock_vault2',
    protocolToken: yearn4.address,
    underlyingToken: dai,
    govToken: yearn,
    decimals: 18,
    chainId: 1,
  });
  const yearn_vault_usdt = new ProtocolVault({
    name: 'yearn_mock_vault2',
    protocolToken: yearn5.address,
    underlyingToken: usdt,
    govToken: yearn,
    decimals: 6,
    chainId: 1,
  });

  // add all protocol vaults to controller
  // for (const protocol of protocols.values()) {
  //   await protocol.addProtocolToController(controller, dao, vaultNumber, allProvidersClass);
  // }

  await yearn_vault_usdc1.addProtocolToController(controller, dao, vaultNumber, allProvidersClass);
  await yearn_vault_usdc2.addProtocolToController(controller, dao, vaultNumber, allProvidersClass);
  await yearn_vault_dai1.addProtocolToController(controller, dao, vaultNumber, allProvidersClass);
  await yearn_vault_dai2.addProtocolToController(controller, dao, vaultNumber, allProvidersClass);
  await yearn_vault_usdt.addProtocolToController(controller, dao, vaultNumber, allProvidersClass);

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
};
