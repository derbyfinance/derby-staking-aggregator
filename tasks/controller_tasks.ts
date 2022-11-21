import { Controller } from '@typechain';
import { controllerInit } from 'deploySettings';
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

task('controller_init', 'initializes the controller').setAction(async (taskArgs, hre) => {
  const controller = await getController(hre);
  const [dao] = await hre.ethers.getSigners();

  await Promise.all([
    controller.connect(dao).addCurveIndex(controllerInit.dai, 0),
    controller.connect(dao).addCurveIndex(controllerInit.usdc, 1),
    controller.connect(dao).addCurveIndex(controllerInit.usdt, 2),
  ]);
});

task('controller_add_protocol', 'add protocol to controller')
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

      await controller
        .connect(dao)
        .addProtocol(name, vaultNumber, provider, protocolLPToken, underlying, govToken, uScale);
    },
  );
