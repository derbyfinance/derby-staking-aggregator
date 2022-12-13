import { deployments, run } from 'hardhat';
import { transferAndApproveUSDC } from '@testhelp/helpers';
import { Controller, MainVaultMock } from '@typechain';
import { allProtocols } from '@testhelp/addresses';
import allProviders from '@testhelp/allProvidersClass';
import { getAllSigners, getContract } from '@testhelp/deployHelpers';
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
