import { expect } from 'chai';
import { Contract } from 'ethers';
import { erc20, formatUSDC, parseUSDC, parseEther, formatEther } from '@testhelp/helpers';
import { usdc, dai, allDAIVaults as protocols } from '@testhelp/addresses';
import AllMockProviders from '@testhelp/classes/allMockProvidersClass';
import { setupVault } from './setup';
import { getDeployConfigVault } from '@testhelp/deployHelpers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe.only('Testing Vault, unit test', async () => {
  const IDAI: Contract = erc20(dai),
    vaultNumber: number = 10;

  const compoundVault = protocols.get('compound_dai_01')!;
  const yearnVault = protocols.get('yearn_dai_01')!;

  const amount = 100000;
  const amountDAI = parseEther(amount.toString());

  it('Should have a name and symbol', async function () {
    const { vault } = await setupVault();
    const { name, symbol, decimals } = await getDeployConfigVault('TestVault4', 'hardhat');
    expect(await vault.name()).to.be.equal(name);
    expect(await vault.symbol()).to.be.equal(symbol);
    expect(await vault.decimals()).to.be.equal(decimals);
  });

  it('Should set delta allocations', async function () {
    const { vault } = await setupVault();
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40),
      yearnVault.setDeltaAllocation(vault, 20),
    ]);

    for (const protocol of protocols.values()) {
      const deltaAllocation = await protocol.getDeltaAllocationTEST(vault);
      expect(deltaAllocation).to.be.greaterThan(0);
      expect(deltaAllocation).to.be.equal(protocol.allocation);
    }
  });

  it('Should be able to blacklist protocol, update allocations and pull all funds', async function () {
    const { vault, controller, user, guardian } = await setupVault();
    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setExpectedBalance(0).setDeltaAllocation(vault, 40),
      yearnVault.setExpectedBalance(30_000).setDeltaAllocation(vault, 20),
    ]);

    await vault.connect(user).depositRequest(amountDAI); 
    await vault.rebalance();

    // blacklist compound_usdc_01
    const deadline = (await time.latest()) + 10_000;
    await vault.connect(guardian).blacklistProtocol(compoundVault.number);
    await vault
      .connect(guardian)
      .withdrawFromBlacklistedProtocol(compoundVault.number, 0, deadline);

    let vaultBalance = formatEther(await IDAI.balanceOf(vault.address));

    let expectedVaultLiquidity = 70000;

    for (const protocol of protocols.values()) {
      const balance = await protocol.balanceUnderlying(vault);
      expect(formatEther(balance)).to.be.closeTo(protocol.expectedBalance, 1);
    }

    expect(await vault.getAllocationTEST(compoundVault.number)).to.be.equal(0);
    expect(await vault.totalAllocatedTokens()).to.be.equal(20);

    expect(vaultBalance).to.be.closeTo(expectedVaultLiquidity, 1);
    expect(
      await controller.connect(guardian).getProtocolBlacklist(vaultNumber, compoundVault.number),
    ).to.be.true;
  });

  it('Should not be able to withdraw from protocol when !blacklisted', async function () {
    const { vault, guardian } = await setupVault();
    const deadline = (await time.latest()) + 10_000;
    await expect(
      vault.connect(guardian).withdrawFromBlacklistedProtocol(compoundVault.number, 0, deadline),
    ).to.be.revertedWith('!Blacklisted');
  });

  it('Should not be able to set delta on blacklisted protocol', async function () {
    const { vault, guardian } = await setupVault();
    await vault.connect(guardian).blacklistProtocol(0);
    await expect(vault.setDeltaAllocations(0, 30)).to.be.revertedWith('Protocol on blacklist');
  });

  it('Should not be able to rebalance in blacklisted protocol', async function () {
    const { vault, controller, user, guardian } = await setupVault();
    await vault.setDeltaAllocationsReceivedTEST(true);

    await Promise.all([
      compoundVault.setExpectedBalance(0).setDeltaAllocation(vault, 40),
      yearnVault.setExpectedBalance(30_000).setDeltaAllocation(vault, 20),
    ]);

    await vault.connect(guardian).blacklistProtocol(compoundVault.number);
    await vault.connect(user).depositRequest(amountDAI);

    await vault.rebalance();

    let vaultBalance = formatEther(await IDAI.balanceOf(vault.address));

    let expectedVaultLiquidity = 70000;

    for (const protocol of protocols.values()) {
      const balance = await protocol.balanceUnderlying(vault);
      expect(formatEther(balance)).to.be.closeTo(protocol.expectedBalance, 1);
    }

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
    const result = await controller
      .connect(guardian)
      .getProtocolBlacklist(vaultNumber, compoundVault.number);
    expect(result).to.be.true;
  });

  it('Should test rebalanceNeeded function', async function () {
    const { vault, user, guardian } = await setupVault();
    await vault.connect(guardian).setRebalanceInterval(1_000_000);

    expect(await vault.rebalanceNeeded()).to.be.false;
    expect(await vault.connect(guardian).rebalanceNeeded()).to.be.true;
  });

  it('Should store prices on rebalance', async function () {
    const { vault, user, dao } = await setupVault();
    await AllMockProviders.deployAllMockProviders(dao);

    const { yearnProvider, compoundProvider } = AllMockProviders;
    await vault.setDeltaAllocationsReceivedTEST(true);
    let compoundPrice = 1;
    let yearnPrice = 3;
    await Promise.all([
      compoundProvider.mock.exchangeRate.returns(compoundPrice),
      yearnProvider.mock.exchangeRate.returns(yearnPrice),
      compoundProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
      yearnProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
      compoundProvider.mock.deposit.returns(0), // to be able to use the rebalance function
      yearnProvider.mock.deposit.returns(0), // to be able to use the rebalance function
      compoundProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
      yearnProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
    ]);
    await vault.setTotalUnderlying();

    // await setDeltaAllocations(user, vaultMock, allProtocols);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40),
      yearnVault.setDeltaAllocation(vault, 20),
    ]);
    await vault.connect(user).depositRequest(amountDAI);
    await vault.rebalance();
  });
});
