import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { dai, usdc, usdt, yearn, yearnUSDC } from '@testhelp/addresses';
import { controllerInit } from 'deploySettings';

describe('Testing controller tasks', () => {
  const setupController = deployments.createFixture(
    async ({ deployments, getNamedAccounts, ethers }, options) => {
      await deployments.fixture(['Controller']);
      const deployment = await deployments.get('Controller');
      const controller = await ethers.getContractAt('Controller', deployment.address);

      return controller;
    },
  );

  it('controller_add_protocol', async function () {
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

    const protocolInfo = await controller.getProtocolInfo(vaultNumber, protocolNumber);
    expect(protocolInfo.LPToken.toLowerCase()).to.be.equal(yearnUSDC.toLowerCase());
    expect(protocolInfo.provider.toLowerCase()).to.be.equal(providerAddress.toLowerCase());
    expect(protocolInfo.underlying.toLowerCase()).to.be.equal(usdc.toLowerCase());
    expect(protocolInfo.uScale).to.be.equal(1e6);
  });

  it('controller_init', async function () {
    const { dai, usdc, usdt, daiCurveIndex, usdcCurveIndex, usdtCurveIndex } = controllerInit;
    const controller = await setupController();

    await run('controller_init');

    expect(await controller.curveIndex(dai)).to.be.equal(daiCurveIndex);
    expect(await controller.curveIndex(usdc)).to.be.equal(usdcCurveIndex);
    expect(await controller.curveIndex(usdt)).to.be.equal(usdtCurveIndex);
  });

  it('controller_add_vault', async function () {
    const vault = '0x90c84237fddf091b1e63f369af122eb46000bc70';
    const controller = await setupController();

    expect(await controller.vaultWhitelist(vault)).to.be.equal(false);
    await run('controller_add_vault', { vault });
    expect(await controller.vaultWhitelist(vault)).to.be.equal(true);
  });

  it('controller_uniswap_setters', async function () {
    const router = '0x90c84237fddf091b1e63f369af122eb46000bc70';
    const quoter = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const poolFee = 3000;

    const controller = await setupController();

    await Promise.all([
      run('controller_set_uniswap_router', { router }),
      run('controller_set_uniswap_quoter', { quoter }),
      run('controller_set_uniswap_poolfee', { poolFee }),
    ]);

    const uniswapParams = await controller.getUniswapParams();
    expect(uniswapParams.router.toLowerCase()).to.be.equal(router.toLowerCase());
    expect(uniswapParams.quoter.toLowerCase()).to.be.equal(quoter.toLowerCase());
    expect(uniswapParams.poolFee).to.be.equal(poolFee);
  });

  it('controller_set_curve_poolfee', async function () {
    const curvePoolFee = 1400;
    const controller = await setupController();

    await run('controller_set_curve_poolfee', { poolFee: curvePoolFee });
    expect(await controller.curve3PoolFee()).to.be.equal(curvePoolFee);
  });

  it('controller_add_curve_index', async function () {
    const curveIndex = 11;
    const controller = await setupController();

    await run('controller_add_curve_index', { token: usdc, index: curveIndex });
    expect(await controller.curveIndex(usdc)).to.be.equal(curveIndex);
  });

  it('controller_add_underlying_scale', async function () {
    const uScale = 2e8;
    const controller = await setupController();

    await run('controller_add_underlying_scale', { stable: usdc, scale: uScale });
    expect(await controller.underlyingUScale(usdc)).to.be.equal(uScale);
  });

  it('controller_gas_price_oracle', async function () {
    const oracle = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    const controller = await setupController();

    await run('controller_gas_price_oracle', { chainlinkGasPriceOracle: oracle });
    expect(await controller.chainlinkGasPriceOracle()).to.be.equal(oracle);
  });

  it('controller_set_claimable', async function () {
    const provider = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    const controller = await setupController();

    expect(await controller.claimable(provider)).to.be.equal(false);
    await run('controller_set_claimable', { provider: provider, bool: true });
    expect(await controller.claimable(provider)).to.be.equal(true);
  });

  it('controller_set_dao', async function () {
    const dao = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
    const controller = await setupController();

    await run('controller_set_dao', { daoAddr: dao });
    expect(await controller.getDao()).to.be.equal(dao);
  });
});
