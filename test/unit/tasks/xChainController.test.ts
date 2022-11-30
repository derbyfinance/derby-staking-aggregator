import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { vaultInitSettings } from 'deploySettings';
import { XChainController } from '@typechain';
import { erc20, getUSDCSigner } from '@testhelp/helpers';
import { usdc } from '@testhelp/addresses';
import { Signer } from 'ethers';
import { DeploymentsExtension } from 'hardhat-deploy/types';
import { HardhatEthersHelpers } from 'hardhat/types';

describe.only('Testing vault tasks', () => {
  const setupXController = deployments.createFixture(
    async ({ ethers, deployments, getNamedAccounts }) => {
      const amount = 1_000_000 * 1e6;

      const accounts = await getNamedAccounts();
      const user = await ethers.getSigner(accounts.user);

      const xController = await deployXChainController(deployments, ethers);
      // await run('vault_init');
      await transferAndApproveUSDC(xController.address, user, amount);

      return { xController, user };
    },
  );

  /*************
  Only Guardian
  **************/

  /*************
  Only Dao
  **************/

  it('xcontroller_set_dao', async function () {
    const { xController } = await setupXController();
    const dao = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('xcontroller_set_dao', { address: dao });
    expect(await xController.getDao()).to.be.equal(dao);
  });

  it('xcontroller_set_guardian', async function () {
    const { xController } = await setupXController();
    const guardian = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';

    await run('xcontroller_set_guardian', { guardian });
    expect(await xController.getGuardian()).to.be.equal(guardian);
  });

  const random = (max: number) => Math.floor(Math.random() * max);

  async function transferAndApproveUSDC(vault: string, user: Signer, amount: number) {
    const usdcSigner = await getUSDCSigner();
    const IUSDC = erc20(usdc);

    await IUSDC.connect(usdcSigner).transfer(user.getAddress(), amount);
    await IUSDC.connect(user).approve(vault, amount);
  }

  async function deployXChainController(
    deployments: DeploymentsExtension,
    ethers: HardhatEthersHelpers,
  ): Promise<XChainController> {
    await deployments.fixture(['XChainController']);
    const deployment = await deployments.get('XChainController');
    const xController: XChainController = await ethers.getContractAt(
      'XChainController',
      deployment.address,
    );

    return xController;
  }
});
