import { expect } from 'chai';
import { Signer, BigNumberish } from 'ethers';
import { parseEther, parseUnits, parseUSDC } from '@testhelp/helpers';
import type { Controller, GameMock, MainVaultMock } from '@typechain';
import {
  compound_dai_01,
  aave_usdt_01,
  yearn_usdc_01,
  aave_usdc_01,
  compound_usdc_01,
  compoundUSDC,
  compoundDAI,
  aaveUSDC,
  yearnUSDC,
  aaveUSDT,
} from '@testhelp/addresses';
import { rebalanceETF } from '@testhelp/vaultHelpers';
import AllMockProviders from '@testhelp/classes/allMockProvidersClass';
import { ProtocolVault } from '@testhelp/classes/protocolVaultClass';
import { vaultDeploySettings } from 'deploySettings';
import { setupXChain } from '../xController/setup';

const amount = 1_000_000;
const homeChain = 10;
const amountUSDC = parseUSDC(amount.toString());

describe.skip('Testing Vault Store Price and Rewards, unit test', async () => {
  let vault: MainVaultMock,
    user: Signer,
    controller: Controller,
    vaultNumber: BigNumberish = vaultDeploySettings.vaultNumber,
    game: GameMock;

  const protocols = new Map<string, ProtocolVault>()
    .set('compound_usdc_01', compound_usdc_01)
    .set('aave_usdc_01', aave_usdc_01)
    .set('yearn_usdc_01', yearn_usdc_01)
    .set('compound_dai_01', compound_dai_01)
    .set('aave_usdt_01', aave_usdt_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;
  const compoundDAIVault = protocols.get('compound_dai_01')!;
  const aaveUSDTVault = protocols.get('aave_usdt_01')!;

  before(async function () {
    const setup = await setupXChain();
    vault = setup.vault1;
    controller = setup.controller;
    user = setup.user;
    game = setup.game;
  });

  it('Should store historical prices and rewards, rebalance: 1', async function () {
    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;

    await vault.setTotalAllocatedTokensTest(parseEther('10000')); // 10k
    await vault.connect(user).deposit(amountUSDC);

    compoundVault.setPrice(parseUnits('1000', compoundVault.decimals));
    aaveVault.setPrice(parseUnits('2000', aaveVault.decimals));
    yearnVault.setPrice(parseUnits('3000', aaveVault.decimals));
    compoundDAIVault.setPrice(parseUnits('4000', aaveVault.decimals));
    aaveUSDTVault.setPrice(parseUnits('5000', aaveVault.decimals));

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(compoundVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(aaveVault.price),
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(yearnVault.price),
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(compoundDAIVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(aaveUSDTVault.price),
    ]);

    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);

    await rebalanceETF(vault);

    await game.upRebalancingPeriod(vaultNumber);
    await vault.sendRewardsToGame();

    for (const protocol of protocols.values()) {
      //expect(await vault.getHistoricalPriceTEST(1, protocol.number)).to.be.equal(protocol.price);
      expect(
        await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 1, protocol.number),
      ).to.be.equal(0);
    }
  });

  it('Should store historical prices and rewards, rebalance: 2', async function () {
    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;

    compoundVault.setPrice(parseUnits('1100', compoundVault.decimals)); // 10%
    aaveVault.setPrice(parseUnits('2100', aaveVault.decimals)); // 5%
    yearnVault.setPrice(parseUnits('3030', aaveVault.decimals)); // 1%
    compoundDAIVault.setPrice(parseUnits('4004', aaveVault.decimals)); // 0.1%
    aaveUSDTVault.setPrice(parseUnits('5010', aaveVault.decimals)); // 0.2%

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(compoundVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(aaveVault.price),
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(yearnVault.price),
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(compoundDAIVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(aaveUSDTVault.price),
    ]);

    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await rebalanceETF(vault);

    await game.upRebalancingPeriod(vaultNumber);
    await vault.sendRewardsToGame();

    for (const protocol of protocols.values()) {
      //expect(await vault.getHistoricalPriceTEST(2, protocol.number)).to.be.equal(protocol.price);
    }

    // 1_000_000 - 100_000 (liq) * percentage gain
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, compoundVault.number),
    ).to.be.equal(899953);
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, aaveVault.number),
    ).to.be.equal(449976);
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, yearnVault.number),
    ).to.be.equal(89995);
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, compoundDAIVault.number),
    ).to.be.equal(8999);
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, aaveUSDTVault.number),
    ).to.be.equal(17999);
  });
});
