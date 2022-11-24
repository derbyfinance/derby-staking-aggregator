import { controllerInit } from 'deploySettings';
import { Result } from 'ethers/lib/utils';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const getController = async ({
  deployments,
  ethers,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const accounts = await getNamedAccounts();
  const dao = await ethers.getSigner(accounts.dao);

  const { address } = await deployments.get('Controller');
  const controller = await ethers.getContractAt('Controller', address);
  return { controller, dao };
};

task('controller_init', 'Initializes the controller').setAction(async (taskArgs, { run }) => {
  const {
    dai,
    usdc,
    usdt,
    daiCurveIndex,
    usdcCurveIndex,
    usdtCurveIndex,
    uniswapRouter,
    uniswapQouter,
    uniswapPoolFee,
    chainlinkGasPriceOracle,
    curve3PoolFee,
    curve3Pool,
  } = controllerInit;

  await Promise.all([
    run('controller_add_curve_index', { token: dai, index: daiCurveIndex }),
    run('controller_add_curve_index', { token: usdc, index: usdcCurveIndex }),
    run('controller_add_curve_index', { token: usdt, index: usdtCurveIndex }),
    run('controller_set_curve_poolfee', { poolFee: curve3PoolFee }),
    run('controller_set_curve_3pool', { pool: curve3Pool }),
    run('controller_set_uniswap_router', { router: uniswapRouter }),
    run('controller_set_uniswap_quoter', { quoter: uniswapQouter }),
    run('controller_set_uniswap_poolfee', { poolFee: uniswapPoolFee }),
    run('controller_gas_price_oracle', { chainlinkGasPriceOracle }),
  ]);
});

task('controller_add_protocol', 'Add protocol to controller')
  .addParam('name', 'Name of the protocol vault combination')
  .addParam('vaultNumber', 'Number of the vault', 0, types.int)
  .addParam('provider', 'Address of the protocol provider')
  .addParam('protocolLPToken', 'Address of protocolToken eg cUSDC')
  .addParam('underlying', 'Address of underlying protocol vault eg USDC')
  .addParam('govToken', 'Address governance token of the protocol')
  .addParam('uScale', 'Underlying scale of the protocol', 0, types.int)
  .setAction(
    async ({ name, vaultNumber, provider, protocolLPToken, underlying, govToken, uScale }, hre) => {
      const { controller, dao } = await getController(hre);

      const tx = await controller
        .connect(dao)
        .addProtocol(name, vaultNumber, provider, protocolLPToken, underlying, govToken, uScale);

      const receipt = await tx.wait();
      const { protocolNumber } = receipt.events![0].args as Result;

      return protocolNumber;
    },
  );

task('controller_add_vault', 'Add vault to controller whitelist')
  .addParam('vault', 'Address of the vault')
  .setAction(async ({ vault }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).addVault(vault);
  });

task('controller_set_uniswap_router', 'Set the Uniswap Router address')
  .addParam('router', 'Address of the router')
  .setAction(async ({ router }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setUniswapRouter(router);
  });

task('controller_set_uniswap_quoter', 'Set the Uniswap Quoter address')
  .addParam('quoter', 'Address of the quoter')
  .setAction(async ({ quoter }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setUniswapQuoter(quoter);
  });

task('controller_set_uniswap_poolfee', 'Set the Uniswap Poolfee')
  .addParam('poolFee', 'Uniswap pool fee', null, types.int)
  .setAction(async ({ poolFee }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setUniswapPoolFee(poolFee);
  });

task('controller_set_curve_poolfee', 'Set the Curve Poolfee')
  .addParam('poolFee', 'Curve pool fee', null, types.int)
  .setAction(async ({ poolFee }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setCurvePoolFee(poolFee);
  });

task('controller_add_curve_index', 'Set curve pool index for underlying token')
  .addParam('token', 'Address of Token')
  .addParam('index', 'Curve index as decribed in Swap pool', null, types.int)
  .setAction(async ({ token, index }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).addCurveIndex(token, index);
  });

task('controller_set_curve_3pool', 'Setter curve3Pool address')
  .addParam('pool', 'New dao address')
  .setAction(async ({ pool }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setCurve3Pool(pool);
  });

task('controller_add_underlying_scale', 'Set the scale for underlying stable coin')
  .addParam('stable', 'Address of stable coin')
  .addParam('scale', 'Scale e.g decimals of stable', null, types.int)
  .setAction(async ({ stable, scale }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).addUnderlyingUScale(stable, scale);
  });

task('controller_gas_price_oracle', 'Setter for the Chainlink Gas price oracle')
  .addParam('chainlinkGasPriceOracle', 'Contract address')
  .setAction(async ({ chainlinkGasPriceOracle }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setGasPriceOracle(chainlinkGasPriceOracle);
  });

task('controller_set_claimable', 'Set if provider have claimable tokens')
  .addParam('provider', 'Address of Derby provider')
  .addParam('bool', 'True of the underlying protocol has claimable tokens', null, types.boolean)
  .setAction(async ({ provider, bool }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setClaimable(provider, bool);
  });

task('controller_set_dao', 'Setter for dao address')
  .addParam('daoAddr', 'New dao address')
  .setAction(async ({ daoAddr }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setDao(daoAddr);
  });
