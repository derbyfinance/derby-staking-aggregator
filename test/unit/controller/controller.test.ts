import { expect } from 'chai';
import { deployments, run } from 'hardhat';
import { deployCompoundProviderMock, deployYearnProviderMock } from '@testhelp/deployMocks';
import {
  usdc,
  yearn as yearnGov,
  compToken as compGov,
  compoundUSDC,
  yearnUSDC,
} from '@testhelp/addresses';
import { addStarterProtocols } from '@testhelp/helpers';
import { getAllSigners, getContract } from '@testhelp/getContracts';
import { Controller } from '@typechain';

const vaultNumber = 4;

describe('Testing controller', async () => {
  const setupController = deployments.createFixture(async (hre) => {
    await deployments.fixture(['Controller']);
    const controller = (await getContract('Controller', hre)) as Controller;
    const [dao, , , vault, deployer] = await getAllSigners(hre);

    await run('controller_init');
    await run('controller_set_vault_whitelist', { vault: vault.address, status: true });

    const [yearnProviderMock, compoundProviderMock] = await Promise.all([
      deployYearnProviderMock(deployer),
      deployCompoundProviderMock(deployer),
    ]);

    const [yearnNumber, compNumber] = await addStarterProtocols(
      {
        yearn: yearnProviderMock.address,
        compound: compoundProviderMock.address,
      },
      vaultNumber,
    );

    return {
      controller,
      vault,
      dao,
      yearnProviderMock,
      compoundProviderMock,
      yearnNumber,
      compNumber,
    };
  });

  it('Should correctly set controller mappings for the protocol names', async function () {
    const { controller, yearnNumber, compNumber } = await setupController();
    const [yearn, compound] = await Promise.all([
      controller.protocolNames(vaultNumber, yearnNumber),
      controller.protocolNames(vaultNumber, compNumber),
    ]);

    expect(yearn).to.be.equal('yearn_usdc_01');
    expect(compound).to.be.equal('compound_usdc_01');
  });

  it('Should correctly set controller mappings for the protocol provider, LPtoken, underlying', async function () {
    const { controller, yearnProviderMock, compoundProviderMock, yearnNumber, compNumber } =
      await setupController();

    const [yearn, compound] = await Promise.all([
      controller.getProtocolInfo(vaultNumber, yearnNumber),
      controller.getProtocolInfo(vaultNumber, compNumber),
    ]);

    expect(yearn.provider).to.be.equal(yearnProviderMock.address);
    expect(compound.provider).to.be.equal(compoundProviderMock.address);

    expect(yearn.LPToken).to.be.equal(yearnUSDC);
    expect(compound.LPToken).to.be.equal(compoundUSDC);

    expect(yearn.underlying).to.be.equal(usdc);
    expect(compound.underlying).to.be.equal(usdc);
  });

  it('Should correctly set governance tokens', async function () {
    const { controller, yearnNumber, compNumber } = await setupController();

    const [yearn, compound] = await Promise.all([
      controller.getGovToken(vaultNumber, yearnNumber),
      controller.getGovToken(vaultNumber, compNumber),
    ]);

    expect(yearn).to.be.equal(yearnGov);
    expect(compound).to.be.equal(compGov);
  });

  it('Should correctly set protocol blacklist', async function () {
    const { controller, vault, yearnNumber } = await setupController();

    let blacklisted = await controller
      .connect(vault)
      .getProtocolBlacklist(vaultNumber, yearnNumber);
    expect(blacklisted).to.equal(false);

    await controller.connect(vault).setProtocolBlacklist(vaultNumber, yearnNumber);

    blacklisted = await controller.connect(vault).getProtocolBlacklist(vaultNumber, yearnNumber);
    expect(blacklisted).to.equal(true);
  });

  it('Should reach the claim function in compound Provider', async function () {
    const { controller, vault, compoundProviderMock, compNumber } = await setupController();

    await run('controller_set_claimable', { lptoken: compoundUSDC, bool: true });

    // Using revert here to make sure the function actually reached the mocked function with arguments
    await compoundProviderMock.mock.claim
      .withArgs(compoundUSDC, vault.address)
      .revertsWithReason('Claimed tokens');

    await expect(controller.connect(vault).claim(vaultNumber, compNumber)).to.be.revertedWith(
      'Claimed tokens',
    );
  });

  it('sets protocol information correctly', async function () {
    const { controller, dao } = await setupController();

    const vaultNumber = 10;
    const protocolNumber = 5;
    const LPToken = '0x1111111111111111111111111111111111111111';
    const provider = '0x2222222222222222222222222222222222222222';
    const underlying = '0x3333333333333333333333333333333333333333';

    await controller
      .connect(dao)
      .setProtocolInfo(vaultNumber, protocolNumber, LPToken, provider, underlying);

    const storedProtocolInfo = await controller.protocolInfo(vaultNumber, protocolNumber);

    expect(storedProtocolInfo.LPToken).to.equal(LPToken);
    expect(storedProtocolInfo.provider).to.equal(provider);
    expect(storedProtocolInfo.underlying).to.equal(underlying);
  });
});
