import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { vaultInitSettings } from 'deploySettings';
import { MainVaultMock } from '@typechain';
import { erc20, getUSDCSigner } from '@testhelp/helpers';
import { usdc } from '@testhelp/addresses';
import { Signer } from 'ethers';

describe.only('Testing vault tasks', () => {
  const setupVault = deployments.createFixture(
    async ({ ethers, deployments, getNamedAccounts }) => {
      const amount = 1_000_000 * 1e6;

      await deployments.fixture(['MainVaultMock']);
      const deployment = await deployments.get('MainVaultMock');
      const vault: MainVaultMock = await ethers.getContractAt('MainVaultMock', deployment.address);
      await run('vault_init');

      const accounts = await getNamedAccounts();
      const user = await ethers.getSigner(accounts.user);
      await transferAndApproveUSDC(vault.address, user, amount);

      return { vault, user };
    },
  );

  const random = (max: number) => Math.floor(Math.random() * max);

  /*************
  Only Guardian
  **************/

  it('vault_set_state', async function () {
    const { vault } = await setupVault();

    expect(await vault.state()).to.be.equal(0);
    await run('vault_set_state', { state: 2 });
    expect(await vault.state()).to.be.equal(2);
    await run('vault_set_state', { state: 4 });
    expect(await vault.state()).to.be.equal(4);
  });

  it('vault_set_home_chain', async function () {
    const { vault } = await setupVault();
    const chainid = random(10_000);

    await run('vault_set_home_chain', { chainid });
    expect(await vault.homeChain()).to.be.equal(chainid);
  });

  it('vault_set_gas_fee_liq', async function () {
    const { vault } = await setupVault();
    const liquidity = random(100_000 * 1e6);

    expect(await vault.gasFeeLiquidity()).to.be.equal(vaultInitSettings.gasFeeLiq);
    await run('vault_set_gas_fee_liq', { liquidity });
    expect(await vault.gasFeeLiquidity()).to.be.equal(liquidity);
  });

  it('vault_set_rebalance_interval', async function () {
    const { vault } = await setupVault();
    const timestamp = random(100_000_000);

    await run('vault_set_rebalance_interval', { timestamp });
    expect(await vault.rebalanceInterval()).to.be.equal(timestamp);
  });

  it('vault_set_margin_scale', async function () {
    const { vault } = await setupVault();
    const scale = random(100_000_000_000);

    expect(await vault.marginScale()).to.be.equal(vaultInitSettings.marginScale);
    await run('vault_set_margin_scale', { scale });
    expect(await vault.marginScale()).to.be.equal(scale);
  });

  it('vault_set_liquidity_perc', async function () {
    const { vault } = await setupVault();
    const percentage = random(100);

    expect(await vault.liquidityPerc()).to.be.equal(vaultInitSettings.liquidityPercentage);
    await run('vault_set_liquidity_perc', { percentage });
    expect(await vault.liquidityPerc()).to.be.equal(percentage);
  });

  /*************
  Only Dao
  **************/

  it('vault_set_dao', async function () {
    const { vault } = await setupVault();
    const dao = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';

    await run('vault_set_dao', { address: dao });
    expect(await vault.getDao()).to.be.equal(dao);
  });

  it('vault_set_guardian', async function () {
    const { vault } = await setupVault();
    const guardian = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('vault_set_guardian', { guardian });
    expect(await vault.getGuardian()).to.be.equal(guardian);
  });

  it('vault_set_homexprovider', async function () {
    const { vault } = await setupVault();
    const address = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

    await run('vault_set_homexprovider', { address });
    expect(await vault.xProvider()).to.be.equal(address);
  });

  it('vault_set_dao_token', async function () {
    const { vault } = await setupVault();
    const address = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('vault_set_dao_token', { address });
    expect(await vault.derbyToken()).to.be.equal(address);
  });

  it('vault_set_game', async function () {
    const { vault } = await setupVault();
    const address = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

    await run('vault_set_game', { address });
    expect(await vault.game()).to.be.equal(address);
  });

  it('vault_set_swap_rewards', async function () {
    const { vault } = await setupVault();

    expect(await vault.swapRewards()).to.be.equal(false);
    await run('vault_set_swap_rewards', { state: true });
    expect(await vault.swapRewards()).to.be.equal(true);
  });

  it('vault_set_performance_fee', async function () {
    const { vault } = await setupVault();
    const fee = random(100);

    expect(await vault.liquidityPerc()).to.be.equal(vaultInitSettings.performanceFee);
    await run('vault_set_performance_fee', { percentage: fee });
    expect(await vault.performanceFee()).to.be.equal(fee);
  });

  async function transferAndApproveUSDC(vault: string, user: Signer, amount: number) {
    const usdcSigner = await getUSDCSigner();
    const IUSDC = erc20(usdc);

    await IUSDC.connect(usdcSigner).transfer(user.getAddress(), amount);
    await IUSDC.connect(user).approve(vault, amount);
  }
});
