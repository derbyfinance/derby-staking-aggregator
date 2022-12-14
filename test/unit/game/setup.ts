import { deployments, run } from 'hardhat';
import { parseEther, random, transferAndApproveUSDC } from '@testhelp/helpers';
import type { GameMock, MainVaultMock, DerbyToken, XChainControllerMock } from '@typechain';

import { getAllSigners, getContract, InitEndpoints, getXProviders } from '@testhelp/deployHelpers';

export const setupGame = deployments.createFixture(async (hre) => {
  await deployments.fixture([
    'XChainControllerMock',
    'MainVaultMock',
    'XProviderMain',
    'XProviderArbi',
    'XProviderOpti',
    'XProviderBnb',
  ]);

  const game = (await getContract('GameMock', hre)) as GameMock;
  const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
  const xChainController = (await getContract('XChainControllerMock', hre)) as XChainControllerMock;
  const vault = (await getContract('MainVaultMock', hre)) as MainVaultMock;

  const [dao, user] = await getAllSigners(hre);
  const userAddr = await user.getAddress();
  const vaultNumber = random(100);

  const [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb] = await getXProviders(
    hre,
    dao,
    {
      xController: 100,
      game: 10,
    },
  );
  await InitEndpoints(hre, [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb]);

  const basketId = await run('game_mint_basket', { vaultnumber: vaultNumber });
  await run('game_init', { provider: xProviderMain.address });
  await run('game_set_home_vault', { vault: vault.address });
  await run('xcontroller_init');
  await run('xcontroller_set_homexprovider', { address: xProviderArbi.address });
  await run('vault_init');
  await run('controller_init');

  await derbyToken.transfer(userAddr, parseEther('2100'));
  await transferAndApproveUSDC(vault.address, user, 100_000_000 * 1e6);

  return { game, derbyToken, vault, dao, user, userAddr, vaultNumber, basketId, xChainController };
});
