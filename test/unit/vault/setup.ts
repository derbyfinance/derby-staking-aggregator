import { deployments, run } from 'hardhat';
import { erc20, transferAndApproveUSDC } from '@testhelp/helpers';
import { Controller, MainVaultMock, XProvider } from '@typechain';
import { allProtocols, compoundUSDC, usdc } from '@testhelp/addresses';
import allProviders from '@testhelp/classes/allProvidersClass';
import { getAllSigners, getContract } from '@testhelp/getContracts';
import { AddAllVaultsToProviders } from '@testhelp/InitialiseContracts';

export const setupVault = deployments.createFixture(async (hre) => {
  const providers = ['CompoundProvider', 'IdleProvider', 'TruefiProvider', 'YearnProvider'];
  await deployments.fixture(['TestVault1', 'XProviderMain', ...providers]);

  const vaultNumber = 10;
  const contract = 'TestVault1';
  const IUSDC = erc20(usdc);
  const [dao, user, guardian] = await getAllSigners(hre);

  const vault = (await getContract(contract, hre, 'MainVaultMock')) as MainVaultMock;
  const controller = (await getContract('Controller', hre)) as Controller;
  const xProviderMain = (await getContract('XProviderMain', hre, 'XProvider')) as XProvider;

  await allProviders.setProviders(hre);
  await transferAndApproveUSDC(vault.address, user, 10_000_000 * 1e6);
  await AddAllVaultsToProviders(dao, providers, [vault.address, controller.address], hre);

  await run('vault_init', { contract });
  await run('controller_init');
  await run('controller_add_vault', { vault: vault.address });
  await run('controller_add_vault', { vault: guardian.address }); // using guardian as mock signer
  await run('controller_set_claimable', {
    lptoken: compoundUSDC,
    bool: true,
  });
  await run('vault_set_homexprovider', { contract: 'TestVault1', address: xProviderMain.address });
  await run('vault_set_liquidity_perc', { contract, percentage: 10 });
  // add all protocol vaults to controller
  for (const protocol of allProtocols.values()) {
    await protocol.addProtocolToController(controller, dao, vaultNumber, allProviders);
  }

  return { vault, controller, dao, user, guardian, contract, IUSDC };
});
