import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { XChainControllerMock } from '@typechain';
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

  it('xcontroller_set_vault_chain_address', async function () {
    const { xController } = await setupXController();
    const vaultnumber = random(100);
    const chainid = random(50_000);
    const vaultAddress = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const underlying = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('xcontroller_set_vault_chain_address', {
      vaultnumber,
      chainid,
      address: vaultAddress,
      underlying,
    });

    expect(await xController.getUnderlyingAddressTEST(vaultnumber, chainid)).to.be.equal(
      underlying,
    );
    expect(await xController.getVaultAddressTEST(vaultnumber, chainid)).to.be.equal(vaultAddress);
  });

  it('xcontroller_set_homexprovider', async function () {
    const { xController } = await setupXController();
    const address = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

    await run('xcontroller_set_homexprovider', { address });
    expect(await xController.xProvider()).to.be.equal(address);
  });

  it('xcontroller_set_home_chain', async function () {
    const { xController } = await setupXController();
    const chainid = random(10_000);

    await run('xcontroller_set_home_chain', { chainid });
    expect(await xController.homeChain()).to.be.equal(chainid);
  });

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

  it('xcontroller_set_game', async function () {
    const { xController } = await setupXController();
    const address = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

    await run('xcontroller_set_game', { address });
    expect(await xController.game()).to.be.equal(address);
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
  ): Promise<XChainControllerMock> {
    await deployments.fixture(['XChainControllerMock']);
    const deployment = await deployments.get('XChainControllerMock');
    const xController: XChainControllerMock = await ethers.getContractAt(
      'XChainControllerMock',
      deployment.address,
    );

    return xController;
  }
});
