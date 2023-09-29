import { expect } from 'chai';
import { parseEther, parseUnits, transferAndApproveUSDC } from '@testhelp/helpers';
import type { Controller, VaultMock } from '@typechain';
import {
  compound_dai_01,
  yearn_usdc_01,
  compound_usdc_01,
  compoundUSDC,
  compoundDAI,
  yearnUSDC,
} from '@testhelp/addresses';
import AllMockProviders from '@testhelp/classes/allMockProvidersClass';
import { ProtocolVault } from '@testhelp/classes/protocolVaultClass';
import { deployments, run } from 'hardhat';
import { getAllSigners, getContract } from '@testhelp/getContracts';
import { Signer } from 'ethers';

describe('Testing Vault Store Price and Rewards, unit test', async () => {
  let vault: VaultMock, guardian: Signer;

  const protocols = new Map<string, ProtocolVault>()
    .set('compound_usdc_01', compound_usdc_01)
    .set('yearn_usdc_01', yearn_usdc_01)
    .set('compound_dai_01', compound_dai_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;
  const compoundDAIVault = protocols.get('compound_dai_01')!;

  const setupVault = deployments.createFixture(async (hre) => {
    await deployments.fixture(['TestVault1']);

    const vaultNumber = 10;
    const contract = 'TestVault1';
    const [dao, user, guardian] = await getAllSigners(hre);
    const totalUnderlying = 100_000 * 1e6;

    const vault = (await getContract(contract, hre, 'VaultMock')) as VaultMock;
    const controller = (await getContract('Controller', hre)) as Controller;

    await AllMockProviders.deployAllMockProviders(dao);
    await transferAndApproveUSDC(vault.address, user, 10_000_000 * 1e6);

    await run('vault_init', { contract });
    await run('controller_init');
    await run('controller_set_vault_whitelist', { vault: vault.address, status: true });
    await run('vault_set_liquidity_perc', { contract, percentage: 10 });

    // add all protocol vaults to controller with mocked providers
    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, dao, vaultNumber, AllMockProviders);
    }

    vault.setSavedTotalUnderlyingTest(totalUnderlying); 

    return { vault, controller, dao, user, guardian };
  });

  before(async function () {
    const setup = await setupVault();
    vault = setup.vault;
    guardian = setup.guardian;
  });

  it('Should store historical prices and rewards, rebalance: 1', async function () {
    const { yearnProvider, compoundProvider } = AllMockProviders;

    compoundVault.setPrice(parseUnits('1000', 8));
    yearnVault.setPrice(parseUnits('3000', 6));
    compoundDAIVault.setPrice(parseUnits('4000', 8));

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(compoundVault.price),
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(yearnVault.price),
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(compoundDAIVault.price),
    ]);

    await vault.setTotalAllocatedTokensTest(parseEther('10000')); // 10k
    const rebalancePeriod = await vault.rebalancingPeriod();

    // first time it will only store the last price
    for (const { number, price } of protocols.values()) {
      await vault.storePriceAndRewardsTest(number);

      expect(await vault.lastPrices(number)).to.be.equal(price);
      expect(await vault.rewardPerLockedToken(rebalancePeriod, number)).to.be.equal(0);
    }
  });

  it('Should store historical prices and rewards, rebalance: 2', async function () {
    const { yearnProvider, compoundProvider } = AllMockProviders;

    // expectedRewards = (totalUnderlying * performanceFee * priceDiff) / (totalAllocatedTokens * lastPrice)
    compoundVault.setPrice(parseUnits('900', 8)).setExpectedReward(-100_000); // 10%
    yearnVault.setPrice(parseUnits('3000', 6)).setExpectedReward(-1); // BLACKLISTED
    compoundDAIVault.setPrice(parseUnits('4004', 8)).setExpectedReward(1_000); // 0.1%

    await vault.connect(guardian).blacklistProtocol(yearnVault.number);

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(compoundVault.price),
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(yearnVault.price),
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(compoundDAIVault.price),
    ]);

    await vault.upRebalancingPeriodTEST();
    const rebalancePeriod = await vault.rebalancingPeriod();

    for (const { number, price, expectedReward } of protocols.values()) {
      await vault.storePriceAndRewardsTest(number);

      expect(await vault.lastPrices(number)).to.be.equal(price);
      // because -1 is not scaled, the rest is.
      expect(await vault.rewardPerLockedToken(rebalancePeriod, number)).to.be.equal(
        expectedReward === -1 ? -1 : parseEther(expectedReward),
      );
    }
  });
});
