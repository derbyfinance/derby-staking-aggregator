import { Controller } from '@typechain';
import { controllerInit } from 'deploySettings';
import { Result } from 'ethers/lib/utils';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const getController = async ({
  deployments,
  ethers,
}: HardhatRuntimeEnvironment): Promise<Controller> => {
  await deployments.all();
  const { address } = await deployments.get('Controller');
  const controller = await ethers.getContractAt('Controller', address);
  return controller;
};

task('controller_init', 'Initializes the controller').setAction(async (taskArgs, { run }) => {
  const { dai, usdc, usdt, daiCurveIndex, usdcCurveIndex, usdtCurveIndex } = controllerInit;

  await Promise.all([
    run('controller_add_curve_index', { token: dai, index: daiCurveIndex }),
    run('controller_add_curve_index', { token: usdc, index: usdcCurveIndex }),
    run('controller_add_curve_index', { token: usdt, index: usdtCurveIndex }),
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
      const controller = await getController(hre);
      const [dao] = await hre.ethers.getSigners();

      const tx = await controller
        .connect(dao)
        .addProtocol(name, vaultNumber, provider, protocolLPToken, underlying, govToken, uScale);

      const receipt = await tx.wait();
      const { protocolNumber } = receipt.events![0].args as Result;

      return protocolNumber;
    },
  );

task('controller_add_vault', 'Set curve pool index for underlying token')
  .addParam('token', 'Address of Token')
  .addParam('index', 'Curve index as decribed in Swap pool', null, types.int)
  .setAction(async ({ token, index }, hre) => {
    const controller = await getController(hre);
    const [dao] = await hre.ethers.getSigners();

    await controller.connect(dao).addCurveIndex(token, index);
  });

task('controller_add_curve_index', 'Set curve pool index for underlying token')
  .addParam('token', 'Address of Token')
  .addParam('index', 'Curve index as decribed in Swap pool', null, types.int)
  .setAction(async ({ token, index }, hre) => {
    const controller = await getController(hre);
    const [dao] = await hre.ethers.getSigners();

    await controller.connect(dao).addCurveIndex(token, index);
  });
