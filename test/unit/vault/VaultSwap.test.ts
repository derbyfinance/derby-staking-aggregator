import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import { Result } from 'ethers/lib/utils';
import {
  erc20,
  formatUnits,
  formatUSDC,
  getUSDCSigner,
  getWhale,
  parseEther,
  parseUnits,
  parseUSDC,
} from '@testhelp/helpers';
import type { Controller, MainVaultMock } from '@typechain';
import { deployController, deployMainVaultMock } from '@testhelp/deploy';
import {
  usdc,
  dai,
  compToken,
  CompWhale,
  compound_dai_01,
  aave_usdt_01,
  yearn_usdc_01,
  aave_usdc_01,
  compound_usdc_01,
} from '@testhelp/addresses';
import { initController, rebalanceETF } from '@testhelp/vaultHelpers';
import allProviders from '@testhelp/allProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';
import { ProtocolVault } from '@testhelp/protocolVaultClass';

const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe.skip('Testing VaultSwap, unit test', async () => {
  let vault: MainVaultMock,
    controller: Controller,
    dao: Signer,
    user: Signer,
    USDCSigner: Signer,
    compSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string,
    IDAI: Contract,
    IComp: Contract;

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

  beforeEach(async function () {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, compSigner, IUSDc, IDAI, IComp, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      getWhale(CompWhale),
      erc20(usdc),
      erc20(dai),
      erc20(compToken),
      dao.getAddress(),
      user.getAddress(),
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployMainVaultMock(
      dao,
      name,
      symbol,
      decimals,
      vaultNumber,
      daoAddr,
      daoAddr,
      userAddr,
      controller.address,
      usdc,
      uScale,
      gasFeeLiquidity,
    );

    await Promise.all([
      initController(controller, [userAddr, vault.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(10)),
      IUSDc.connect(user).approve(vault.address, amountUSDC.mul(10)),
    ]);

    await controller.setClaimable(allProviders.compoundProvider.address, true);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, allProviders);
      await protocol.resetAllocation(vault);
    }
  });

  it('Claim function in vault should claim COMP and sell for more then minAmountOut in USDC', async function () {
    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, 60),
      aaveVault.setDeltaAllocation(vault, user, 0),
      yearnVault.setDeltaAllocation(vault, user, 0),
    ]);

    const amountToDeposit = parseUSDC('100000');

    // Deposit and rebalance with 100k in only Compound
    await vault.connect(user).deposit(amountToDeposit);
    await vault.setVaultState(3);
    await vault.rebalanceETF();
    // mine 100 blocks to gain COMP Tokens
    for (let i = 0; i <= 100; i++) await network.provider.send('evm_mine');

    const USDCBalanceBeforeClaim = await IUSDc.balanceOf(vault.address);
    await vault.claimTokens();
    const USDCBalanceAfterClaim = await IUSDc.balanceOf(vault.address);

    const USDCReceived = USDCBalanceAfterClaim.sub(USDCBalanceBeforeClaim);
    console.log(`USDC Received ${USDCReceived}`);

    expect(Number(USDCBalanceAfterClaim)).to.be.greaterThan(Number(USDCBalanceBeforeClaim));
  });

  it('Swapping COMP to USDC and calc minAmountOut with swapTokensMulti', async function () {
    const swapAmount = parseUnits('100', 18); // 1000 comp tokens
    await IComp.connect(compSigner).transfer(vault.address, swapAmount);

    let compBalance = await IComp.balanceOf(vault.address);
    let usdcBalance = await IUSDc.balanceOf(vault.address);

    expect(compBalance).to.be.equal(swapAmount);
    expect(usdcBalance).to.be.equal(0);

    const tx = await vault.swapMinAmountOutMultiTest(swapAmount, compToken, usdc);
    const receipt = await tx.wait();
    const { minAmountOut } = receipt.events!.at(-1)!.args as Result;

    await vault.swapTokensMultiTest(swapAmount, compToken, usdc);
    compBalance = await IComp.balanceOf(vault.address);
    usdcBalance = await IUSDc.balanceOf(vault.address);

    expect(usdcBalance).to.be.equal(minAmountOut);
    expect(compBalance).to.be.equal(0);
  });

  it('Swapping USDC to COMP and COMP back to USDC', async function () {
    const swapAmount = parseUSDC('10000');
    await IUSDc.connect(user).transfer(vault.address, swapAmount);
    const usdcBalance = await IUSDc.balanceOf(vault.address);
    console.log(`USDC Balance vault: ${usdcBalance}`);

    await vault.swapTokensMultiTest(swapAmount, usdc, compToken);

    const compBalance = await IComp.balanceOf(vault.address);
    console.log(`Comp Balance vault: ${compBalance}`);

    // Atleast receive some COMP
    expect(formatUnits(compBalance, 18)).to.be.greaterThan(0);
    await vault.swapTokensMultiTest(compBalance, compToken, usdc);

    console.log(`USDC Balance vault End: ${await IUSDc.balanceOf(vault.address)}`);
    const compBalanceEnd = await IComp.balanceOf(vault.address);
    const usdcBalanceEnd = await IUSDc.balanceOf(vault.address);

    // MultiHop swap fee is 0,6% => total fee = +- 1,2% => 10_000 * 1,2% = 120 fee
    expect(Number(formatUSDC(usdcBalanceEnd))).to.be.closeTo(10_000 - 120, 25);
    expect(compBalanceEnd).to.be.equal(0);
  });

  it('Curve Stable coin swap USDC to DAI', async function () {
    const swapAmount = parseUSDC('10000');
    await IUSDc.connect(user).transfer(vault.address, swapAmount);

    // USDC Balance vault
    const usdcBalance = await IUSDc.balanceOf(vault.address);
    console.log(`USDC Balance vault: ${formatUSDC(usdcBalance)}`);

    // Curve swap USDC to DAI
    await vault.curveSwapTest(swapAmount, usdc, dai);

    // DAI Balance vault
    const daiBalance = await IDAI.balanceOf(vault.address);
    console.log(`Dai Balance vault: ${formatUnits(daiBalance, 18)}`);

    // Expect DAI received to be 10_000 - fee
    expect(Number(formatUnits(daiBalance, 18))).to.be.closeTo(10_000, 5);
  });

  it('Should add CompoundDAI and AaveUSDT to vault and Swap on deposit/withdraw', async function () {
    const amount = 1_000_000;
    const amountUSDC = parseUSDC(amount.toString());

    await vault.setDeltaAllocationsReceivedTEST(true);

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, 20),
      aaveVault.setDeltaAllocation(vault, user, 0),
      yearnVault.setDeltaAllocation(vault, user, 0),
      compoundDAIVault.setDeltaAllocation(vault, user, 40),
      aaveUSDTVault.setDeltaAllocation(vault, user, 40),
    ]);

    // Deposit and rebalance with 100k
    await vault.connect(user).deposit(amountUSDC);
    await vault.setVaultState(3);
    let gasUsed = await rebalanceETF(vault);
    let gasUsedUSDC = formatUSDC(gasUsed);

    let totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    let balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    console.log(`USDC Balance vault: ${balanceVault}`);

    // Check if balanceInProtocol ===
    // currentAllocation / totalAllocated * ( amountDeposited - balanceVault - gasUsed)
    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance =
        (amount - balanceVault - gasUsedUSDC) * (protocol.allocation / totalAllocatedTokens);

      console.log(`---------------------------`);
      console.log(protocol.name);
      console.log(protocol.number);
      console.log(protocol.allocation);
      console.log({ totalAllocatedTokens });
      console.log({ balanceUnderlying });
      console.log({ expectedBalance });

      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 100);
    }

    console.log('----------- Rebalance AaveUSDT to 0, compoundDAI to 10 -----------');
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, 20),
      aaveVault.setDeltaAllocation(vault, user, 0),
      yearnVault.setDeltaAllocation(vault, user, 0),
      compoundDAIVault.setDeltaAllocation(vault, user, -30),
      aaveUSDTVault.setDeltaAllocation(vault, user, -40),
    ]);
    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);

    gasUsed = gasUsed.add(await rebalanceETF(vault));
    gasUsedUSDC = formatUSDC(gasUsed);

    totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    console.log(`USDC Balance vault: ${balanceVault}`);

    // Check if balanceInProtocol ===
    // currentAllocation / totalAllocated * ( amountDeposited - balanceVault - gasUsed)
    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance =
        (amount - balanceVault - gasUsedUSDC) * (protocol.allocation / totalAllocatedTokens);

      console.log(`---------------------------`);
      console.log(protocol.name);
      console.log(protocol.number);
      console.log(protocol.allocation);
      console.log({ totalAllocatedTokens });
      console.log({ balanceUnderlying });
      console.log({ expectedBalance });

      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 400);
    }
  });

  it('Swapping USDC to Ether, unwrap and send to DAO to cover gas costs', async function () {
    const amountToDeposit = parseUSDC('100000');
    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, 40),
      aaveVault.setDeltaAllocation(vault, user, 60),
      yearnVault.setDeltaAllocation(vault, user, 20),
    ]);
    await vault.connect(user).deposit(amountToDeposit);

    const ETHBalanceBefore = await dao.getBalance();
    await vault.setVaultState(3);
    await vault.connect(dao).rebalanceETF();
    const ETHBalanceReceived = (await dao.getBalance()).sub(ETHBalanceBefore);
    console.log({ ETHBalanceReceived });

    // gas costs in hardhat are hard to compare, so we expect to receive atleast some Ether (0.03) back after the rebalance function
    expect(Number(ETHBalanceReceived)).to.be.greaterThan(Number(parseEther('0.03')));
  });

  it('Should always have some liquidity to pay for Rebalance fee', async function () {
    const gasFeeLiquidity = 10_000;
    const amountToDeposit = parseUSDC('100000');
    let amountToWithdraw = parseUSDC('50000');

    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, 40),
      aaveVault.setDeltaAllocation(vault, user, 60),
      yearnVault.setDeltaAllocation(vault, user, 20),
    ]);

    // Deposit and rebalance with 100k
    await vault.connect(user).deposit(amountToDeposit);
    await vault.setVaultState(3);

    let gasUsed = formatUSDC(await rebalanceETF(vault));

    let balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    let USDCBalanceUser = await IUSDc.balanceOf(userAddr);
    console.log({ gasUsed });
    console.log(USDCBalanceUser);

    expect(Number(balanceVault)).to.be.greaterThanOrEqual(gasFeeLiquidity - Number(gasUsed));

    console.log('-----------------withdraw 50k-----------------');
    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, -40),
      aaveVault.setDeltaAllocation(vault, user, -60),
      yearnVault.setDeltaAllocation(vault, user, 120),
    ]);

    await vault.connect(user).withdraw(amountToWithdraw);
    await vault.setVaultState(3);
    gasUsed = formatUSDC(await rebalanceETF(vault));

    balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    USDCBalanceUser = await IUSDc.balanceOf(userAddr);
    console.log({ gasUsed });
    console.log(USDCBalanceUser);

    expect(Number(balanceVault)).to.be.greaterThanOrEqual(gasFeeLiquidity - Number(gasUsed));

    console.log('-----------------withdraw another 42k = 92k total-----------------');
    amountToWithdraw = parseUSDC('42000');
    await vault.connect(user).withdraw(amountToWithdraw);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await vault.setVaultState(3);
    await rebalanceETF(vault);

    balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    USDCBalanceUser = await IUSDc.balanceOf(userAddr);
    console.log({ gasUsed });
    console.log(USDCBalanceUser);

    expect(Number(balanceVault)).to.be.greaterThanOrEqual(100_000 - 92_000 - Number(gasUsed));
  });
});
