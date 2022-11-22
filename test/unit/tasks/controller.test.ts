import { deployments, ethers, run } from 'hardhat';
import { expect } from 'chai';
import { dai, usdc, usdt, yearn, yearnUSDC } from '@testhelp/addresses';
import { controllerInit } from 'deploySettings';

describe('Testing controller', () => {
  const setupController = deployments.createFixture(
    async ({ deployments, getNamedAccounts, ethers }, options) => {
      await deployments.fixture(['Controller']);
      const deployment = await deployments.get('Controller');
      const controller = await ethers.getContractAt('Controller', deployment.address);

      return controller;
    },
  );

  it('controller_init task', async function () {
    const { dai, usdc, usdt, daiCurveIndex, usdcCurveIndex, usdtCurveIndex } = controllerInit;
    const controller = await setupController();

    await run('controller_init');

    expect(await controller.curveIndex(dai)).to.be.equal(daiCurveIndex);
    expect(await controller.curveIndex(usdc)).to.be.equal(usdcCurveIndex);
    expect(await controller.curveIndex(usdt)).to.be.equal(usdtCurveIndex);
  });

  it('controller_add_protocol task', async function () {
    const controller = await setupController();
    const vaultNumber = 10;
    const providerAddress = '0x90c84237fddf091b1e63f369af122eb46000bc70'; // dummy

    const protocolNumber = await run(`controller_add_protocol`, {
      name: 'yearn_usdc_01',
      vaultNumber: vaultNumber,
      provider: providerAddress,
      protocolLPToken: yearnUSDC,
      underlying: usdc,
      govToken: yearn,
      uScale: 1e6,
    });

    console.log(protocolNumber);
  });
});
