import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { gameDeploySettings, vaultDeploySettings } from 'deploySettings';
import { MainVaultMock } from '@typechain';
import { erc20, getUSDCSigner } from '@testhelp/helpers';
import { usdc } from '@testhelp/addresses';
import { HardhatEthersHelpers, HardhatRuntimeEnvironment } from 'hardhat/types';

describe.only('Testing vault tasks', () => {
  const setupVault = deployments.createFixture(
    async ({ ethers, deployments, getNamedAccounts }) => {
      const amount = 1_000_000 * 1e6;

      await deployments.fixture(['MainVaultMock']);
      const deployment = await deployments.get('MainVaultMock');
      const vault: MainVaultMock = await ethers.getContractAt('MainVaultMock', deployment.address);

      const { user } = await getNamedAccounts();
      await transferApproveUSDC(vault.address, user, amount, ethers);

      return { vault, user };
    },
  );

  async function transferApproveUSDC(
    vault: string,
    user: string,
    amount: number,
    ethers: HardhatEthersHelpers,
  ) {
    const signer = await ethers.getSigner(user);

    const usdcSigner = await getUSDCSigner();
    const IUSDC = erc20(usdc);

    await IUSDC.connect(usdcSigner).transfer(user, amount);
    await IUSDC.connect(signer).approve(vault, amount);
  }

  const random = (max: number) => Math.floor(Math.random() * max);

  it('vault_deposit', async function () {
    const { vault, user } = await setupVault();
    const amount = random(10_000 * 1e6);

    await run('vault_deposit', { amount });
    const balance = await vault.balanceOf(user);
    console.log({ balance });
  });

  /*************
  Only Guardian
  **************/
});
