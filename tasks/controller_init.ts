import { controllerInit } from 'deploySettings';
import { task } from 'hardhat/config';

export default task('controller_init', 'initializes the controller').setAction(
  async (taskArgs, { deployments, ethers }) => {
    await deployments.all();
    const [dao] = await ethers.getSigners();
    const { address } = await deployments.get('Controller');
    const controller = await ethers.getContractAt('Controller', address);

    await controller.connect(dao).addCurveIndex(controllerInit.dai, 0);
    await controller.connect(dao).addCurveIndex(controllerInit.usdc, 1);
    await controller.connect(dao).addCurveIndex(controllerInit.usdt, 2);
  },
);
