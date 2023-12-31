import { deployments, run } from 'hardhat';
import { erc20, transferAndApproveUSDC, transferAndApproveDAI } from '@testhelp/helpers';
import { Controller, VaultMock, XProvider } from '@typechain';
import { allProtocols, allDAIVaults, compoundUSDC, usdc, steth, dai } from '@testhelp/addresses';
import allProviders from '@testhelp/classes/allProvidersClass';
import { getAllSigners, getContract } from '@testhelp/getContracts';
import { AddAllVaultsToProviders } from '@testhelp/InitialiseContracts';

export const setupVault = deployments.createFixture(async (hre) => {
  const providers = ['CompoundProvider', 'IdleProvider', 'TruefiProvider', 'YearnProvider'];
  await deployments.fixture(['TestVault4', 'XProviderMain', ...providers]);

  const vaultNumber = 10;
  const contract = 'TestVault4';
  const ISTETH = erc20(steth);
  const IDAI = erc20(dai);
  const [dao, user, guardian] = await getAllSigners(hre);

  const vault = (await getContract(contract, hre, 'VaultMock')) as VaultMock;
  const controller = (await getContract('Controller', hre)) as Controller;
  const xProviderMain = (await getContract('XProviderMain', hre, 'XProvider')) as XProvider;

  await allProviders.setProviders(hre);
  await transferAndApproveDAI(vault.address, user, '10000000000000000000000000'); // 100_000 dai
  await AddAllVaultsToProviders(dao, providers, [vault.address, controller.address], hre);

  await run('vault_init', { contract });
  await run('controller_init');
  await run('controller_set_vault_whitelist', { vault: vault.address, status: true });
  await run('controller_set_vault_whitelist', { vault: guardian.address, status: true }); // using guardian as mock signer
  await run('controller_set_claimable', {
    lptoken: compoundUSDC,
    bool: true,
  });
  await run('vault_set_homexprovider', { contract: 'TestVault4', address: xProviderMain.address });
  await run('vault_set_liquidity_perc', { contract, percentage: 10 });
  // add all protocol vaults to controller
  for (const protocol of allDAIVaults.values()) {
    await protocol.addProtocolToController(controller, dao, vaultNumber, allProviders);
  }
  return { vault, controller, dao, user, guardian, contract, ISTETH, IDAI };
});
