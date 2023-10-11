import { deployments, run } from 'hardhat';
import { parseEther, transferAndApproveUSDC, transferAndApproveSTETH } from '@testhelp/helpers';
import type { GameMock, VaultMock, DerbyToken } from '@typechain';

import {
  getAndInitXProviders,
  InitConnextMock,
  setGameLatestProtocolIds,
} from '@testhelp/InitialiseContracts';
import { getAllSigners, getContract, getTestVaults } from '@testhelp/getContracts';

export const setupGame = deployments.createFixture(async (hre) => {
  await deployments.fixture([
    'TestVault1',
    'TestVault2',
    'TestVault3',
    'TestVault4',
    'XProviderMain',
    'XProviderArbi',
    'XProviderOpti',
    'XProviderBnb',
  ]);

  const game = (await getContract('GameMock', hre)) as GameMock;
  const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
  const [vault0, vault1, vault2, vault3] = await getTestVaults(hre);

  const [dao, user, guardian] = await getAllSigners(hre);
  const userAddr = await user.getAddress();
  const vaultNumber = 10;
  const chainids = [10, 100, 1000];

  const [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb] = await getAndInitXProviders(
    hre,
    dao,
    {
      game: 10
    },
  );
  await InitConnextMock(hre, [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb]);

  await run('game_init', {
    provider: xProviderMain.address,
    homevault: vault3.address,
    chainids,
  });

  await run('vault_init', { contract: 'TestVault4' });
  await run('vault_set_liquidity_perc', { contract: 'TestVault4', percentage: 10 });
  await run('vault_init', { contract: 'TestVault2' });
  await run('vault_set_liquidity_perc', { contract: 'TestVault2', percentage: 10 });
  await run('vault_init', { contract: 'TestVault3' });
  await run('vault_set_liquidity_perc', { contract: 'TestVault3', percentage: 10 });
  await run('controller_init');
  
  run('vault_set_homexprovider', { contract: 'TestVault4', address: xProviderMain.address });

  await derbyToken.transfer(userAddr, parseEther('2100'));
  await transferAndApproveSTETH(vault3.address, user, 1_000 * 1e18);
  await transferAndApproveUSDC(vault1.address, user, 100_000_000 * 1e6);
  await transferAndApproveUSDC(vault2.address, user, 100_000_000 * 1e6);
  await setGameLatestProtocolIds(hre, { vaultNumber, latestId: 5, chainids: chainids });
  const basketId0 = await run('game_mint_basket', { chainid: chainids[0], vaultnumber: vaultNumber });
  const basketId1 = await run('game_mint_basket', { chainid: chainids[1], vaultnumber: vaultNumber });
  const basketId2 = await run('game_mint_basket', { chainid: chainids[2], vaultnumber: vaultNumber });

  return {
    game,
    derbyToken,
    vault3,
    vault1,
    vault2,
    dao,
    guardian,
    user,
    userAddr,
    vaultNumber,
    basketId0,
    basketId1,
    basketId2
  };
});
