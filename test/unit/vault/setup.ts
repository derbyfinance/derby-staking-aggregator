import { deployments, run } from 'hardhat';
import { transferAndApproveUSDC } from '@testhelp/helpers';
import { Controller, DerbyToken, GameMock, MainVaultMock, XChainControllerMock } from '@typechain';
import { allProtocols, usdc } from '@testhelp/addresses';
import allProviders from '@testhelp/allProvidersClass';
import AllMockProviders from '@testhelp/allMockProvidersClass';
import {
  getAllSigners,
  getContract,
  getXProviders,
  InitEndpoints,
  InitProviders,
} from '@testhelp/deployHelpers';
import { vaultDeploySettings } from 'deploySettings';

export const setupVault = deployments.createFixture(async (hre) => {
  await deployments.fixture([
    'MainVaultMock',
    'YearnProvider',
    'CompoundProvider',
    'AaveProvider',
    'TruefiProvider',
    'HomoraProvider',
    'IdleProvider',
    'BetaProvider',
  ]);

  const [dao, user, guardian] = await getAllSigners(hre);

  const vault = (await getContract('MainVaultMock', hre)) as MainVaultMock;
  const controller = (await getContract('Controller', hre)) as Controller;

  await allProviders.setProviders(hre);
  await transferAndApproveUSDC(vault.address, user, 10_000_000 * 1e6);

  await run('vault_init');
  await run('controller_init');
  await run('controller_add_vault', { vault: vault.address });
  await run('controller_add_vault', { vault: guardian.address }); // using guardian as mock signer
  await run('controller_set_claimable', {
    provider: allProviders.compoundProvider.address,
    bool: true,
  });

  // add all protocol vaults to controller
  for (const protocol of allProtocols.values()) {
    await protocol.addProtocolToController(
      controller,
      dao,
      vaultDeploySettings.vaultNumber,
      allProviders,
    );
  }

  return { vault, controller, dao, user, guardian };
});

export const setupVaultXChain = deployments.createFixture(async (hre) => {
  await deployments.fixture([
    'XChainControllerMock',
    'MainVaultMock',
    'YearnProvider',
    'CompoundProvider',
    'AaveProvider',
    'TruefiProvider',
    'HomoraProvider',
    'IdleProvider',
    'BetaProvider',
    'XProviderMain',
    'XProviderArbi',
    'XProviderOpti',
  ]);

  const [dao, user, guardian] = await getAllSigners(hre);
  const vaultNumber = vaultDeploySettings.vaultNumber;
  const gameChain = 10;

  const game = (await getContract('GameMock', hre)) as GameMock;
  const controller = (await getContract('Controller', hre)) as Controller;
  const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
  const xChainController = (await getContract('XChainControllerMock', hre)) as XChainControllerMock;
  const vault = (await getContract('MainVaultMock', hre)) as MainVaultMock;

  await allProviders.setProviders(hre);
  await AllMockProviders.deployAllMockProviders(dao);
  await transferAndApproveUSDC(vault.address, user, 10_000_000 * 1e6);

  const [xProviderMain, xProviderArbi] = await getXProviders(hre, { xController: 100, game: 10 });
  await InitProviders(dao, [xProviderMain, xProviderArbi]);
  await InitEndpoints(hre, [xProviderMain, xProviderArbi]);

  await xProviderMain.connect(dao).toggleVaultWhitelist(vault.address);

  await run('game_init', { provider: xProviderMain.address });
  await run('vault_init');
  await run('controller_init');
  await run('xcontroller_init');

  await run('game_set_home_vault', { vault: vault.address });
  await run('xcontroller_set_homexprovider', { address: xProviderArbi.address });

  await run('controller_add_vault', { vault: vault.address });
  await run('vault_set_homexprovider', { address: xProviderMain.address });
  await run('vault_set_home_chain', { chainid: 10 });

  await Promise.all([
    xProviderMain.connect(dao).setTrustedRemote(100, xProviderArbi.address),
    xProviderArbi.connect(dao).setTrustedRemote(10, xProviderMain.address),
    //xProviderMain.connect(dao).toggleVaultWhitelist(vault.address),
    //xProviderArbi.connect(dao).toggleVaultWhitelist(vault.address),
    xProviderMain.connect(dao).setGameChainId(gameChain),
    xProviderArbi.connect(dao).setGameChainId(gameChain),
    game.connect(guardian).setVaultAddress(vaultNumber, 10, vault.address),
    xChainController.connect(dao).setVaultChainAddress(vaultNumber, 10, vault.address, usdc),
    xChainController.connect(dao).setHomeXProvider(xProviderArbi.address),
  ]);

  // add all protocol vaults to controller
  for (const protocol of allProtocols.values()) {
    await protocol.addProtocolToController(
      controller,
      dao,
      vaultDeploySettings.vaultNumber,
      allProviders,
    );
  }

  return { vault, controller, game, xChainController, dao, user, guardian };
});
