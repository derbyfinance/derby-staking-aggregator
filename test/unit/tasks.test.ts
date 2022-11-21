import { deployments, ethers, run } from 'hardhat';

describe('Token', () => {
  const setupController = deployments.createFixture(
    async ({ deployments, getNamedAccounts, ethers }, options) => {
      // await deployments.fixture(['Controller']);
      const deployment = await deployments.get('Controller');
      const controller = await ethers.getContractAt('Controller', deployment.address);
      // await run('controller_init');

      return controller;
    },
  );

  it('testing 1', async function () {
    const controller = await setupController();
    const test = await controller.curveIndex('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    console.log(test);
  });

  it('testing 2', async function () {
    const controller = await setupController();
    const test = await controller.curveIndex('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    console.log(test);
  });
});
