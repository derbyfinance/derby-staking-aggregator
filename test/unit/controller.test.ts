import { expect } from 'chai';
import { deployments, run } from 'hardhat';
import {
  deployAaveProviderMock,
  deployCompoundProviderMock,
  deployYearnProviderMock,
} from '@testhelp/deployMocks';
import {
  usdc,
  yearn as yearnGov,
  compToken as compGov,
  aave as aaveGov,
  compoundUSDC,
  yearnUSDC,
  aaveUSDC,
} from '@testhelp/addresses';

const vaultNumber = 4;

describe('Testing controller', async () => {
  const setupController = deployments.createFixture(
    async ({ deployments, ethers, getNamedAccounts }) => {
      await deployments.fixture(['Controller']);
      const deployment = await deployments.get('Controller');
      const controller = await ethers.getContractAt('Controller', deployment.address);

      const { deploy, vault } = await getNamedAccounts();
      const deployer = await ethers.getSigner(deploy);
      const vaultSigner = await ethers.getSigner(vault);

      await run('controller_init');
      await run('controller_add_vault', { vault });

      const [yearnProviderMock, compoundProviderMock, aaveProviderMock] = await Promise.all([
        deployYearnProviderMock(deployer),
        deployCompoundProviderMock(deployer),
        deployAaveProviderMock(deployer),
      ]);

      const yearnNumber = await run(`controller_add_protocol`, {
        name: 'yearn_usdc_01',
        vaultNumber: vaultNumber,
        provider: yearnProviderMock.address,
        protocolLPToken: yearnUSDC,
        underlying: usdc,
        govToken: yearnGov,
        uScale: 1e6,
      });
      const compNumber = await run(`controller_add_protocol`, {
        name: 'compound_usdc_01',
        vaultNumber: vaultNumber,
        provider: compoundProviderMock.address,
        protocolLPToken: compoundUSDC,
        underlying: usdc,
        govToken: compGov,
        uScale: 1e6,
      });
      const aaveNumber = await run(`controller_add_protocol`, {
        name: 'aave_usdc_01',
        vaultNumber: vaultNumber,
        provider: aaveProviderMock.address,
        protocolLPToken: aaveUSDC,
        underlying: usdc,
        govToken: aaveGov,
        uScale: 1e6,
      });

      return {
        controller,
        vaultSigner,
        yearnProviderMock,
        compoundProviderMock,
        aaveProviderMock,
        yearnNumber,
        compNumber,
        aaveNumber,
      };
    },
  );

  it('Should correctly set controller mappings for the protocol names', async function () {
    const { controller, yearnNumber, compNumber, aaveNumber } = await setupController();
    const [yearn, compound, aave] = await Promise.all([
      controller.protocolNames(vaultNumber, yearnNumber),
      controller.protocolNames(vaultNumber, compNumber),
      controller.protocolNames(vaultNumber, aaveNumber),
    ]);

    expect(yearn).to.be.equal('yearn_usdc_01');
    expect(compound).to.be.equal('compound_usdc_01');
    expect(aave).to.be.equal('aave_usdc_01');
  });

  it('Should correctly set controller mappings for the protocol provider, LPtoken, underlying', async function () {
    const {
      controller,
      yearnProviderMock,
      compoundProviderMock,
      aaveProviderMock,
      yearnNumber,
      compNumber,
      aaveNumber,
    } = await setupController();

    const [yearn, compound, aave] = await Promise.all([
      controller.getProtocolInfo(vaultNumber, yearnNumber),
      controller.getProtocolInfo(vaultNumber, compNumber),
      controller.getProtocolInfo(vaultNumber, aaveNumber),
    ]);

    expect(yearn.provider).to.be.equal(yearnProviderMock.address);
    expect(compound.provider).to.be.equal(compoundProviderMock.address);
    expect(aave.provider).to.be.equal(aaveProviderMock.address);

    expect(yearn.LPToken).to.be.equal(yearnUSDC);
    expect(compound.LPToken).to.be.equal(compoundUSDC);
    expect(aave.LPToken).to.be.equal(aaveUSDC);

    expect(yearn.underlying).to.be.equal(usdc);
    expect(compound.underlying).to.be.equal(usdc);
    expect(aave.underlying).to.be.equal(usdc);
  });

  it('Should correctly set governance tokens', async function () {
    const { controller, yearnNumber, compNumber, aaveNumber } = await setupController();

    const [yearn, compound, aave] = await Promise.all([
      controller.getGovToken(vaultNumber, yearnNumber),
      controller.getGovToken(vaultNumber, compNumber),
      controller.getGovToken(vaultNumber, aaveNumber),
    ]);

    expect(yearn).to.be.equal(yearnGov);
    expect(compound).to.be.equal(compGov);
    expect(aave).to.be.equal(aaveGov);
  });

  it('Should correctly set protocol blacklist', async function () {
    const { controller, vaultSigner, yearnNumber } = await setupController();

    let blacklisted = await controller
      .connect(vaultSigner)
      .getProtocolBlacklist(vaultNumber, yearnNumber);
    expect(blacklisted).to.be.equal(false);

    await controller.connect(vaultSigner).setProtocolBlacklist(vaultNumber, yearnNumber);

    blacklisted = await controller
      .connect(vaultSigner)
      .getProtocolBlacklist(vaultNumber, yearnNumber);
    expect(blacklisted).to.be.equal(true);
  });
});
