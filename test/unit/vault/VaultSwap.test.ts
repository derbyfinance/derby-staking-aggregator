import { network } from 'hardhat';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { Result } from 'ethers/lib/utils';
import {
  erc20,
  formatUnits,
  formatUSDC,
  getSwapDeadline,
  getUSDCSigner,
  getWhale,
  parseUnits,
  parseUSDC,
} from '@testhelp/helpers';
import {
  usdc,
  dai,
  compToken,
  CompWhale,
  yearn_usdc_01,
  compound_usdc_01,
} from '@testhelp/addresses';
import { ProtocolVault } from '@testhelp/classes/protocolVaultClass';
import { setupVault } from './setup';

describe('Testing VaultSwap, unit test', async () => {
  const IUSDc: Contract = erc20(usdc),
    IComp: Contract = erc20(compToken);

  const protocols = new Map<string, ProtocolVault>()
    .set('compound_usdc_01', compound_usdc_01)
    .set('yearn_usdc_01', yearn_usdc_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  it('Claim function in vault should claim COMP and sell for more then minAmountOut in USDC', async function () {
    const { vault, user, guardian } = await setupVault();
    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 60),
      yearnVault.setDeltaAllocation(vault, 0),
    ]);

    const amountToDeposit = parseUSDC('100000');

    // Deposit and rebalance with 100k in only Compound
    await vault.connect(user).deposit(amountToDeposit);
    await vault.setVaultState(3);
    await vault.rebalance();
    // mine 100 blocks to gain COMP Tokens
    for (let i = 0; i <= 100; i++) await network.provider.send('evm_mine');

    const USDCBalanceBeforeClaim = await IUSDc.balanceOf(vault.address);

    // Should revert with high minAmountOut
    await expect(
      vault.connect(guardian).claimAndSwapTokens(compoundVault.number, parseUSDC('100')),
    ).to.be.revertedWith('Too little received');

    await vault.connect(guardian).claimAndSwapTokens(compoundVault.number, parseUSDC('0.01'));
    const USDCBalanceAfterClaim = await IUSDc.balanceOf(vault.address);

    const USDCReceived = USDCBalanceAfterClaim.sub(USDCBalanceBeforeClaim);
    console.log(`USDC Received ${USDCReceived}`);

    expect(Number(USDCBalanceAfterClaim)).to.be.greaterThan(Number(USDCBalanceBeforeClaim));
  });

  it('Swapping COMP to USDC and calc minAmountOut with swapTokensMulti', async function () {
    const { vault, user } = await setupVault();
    const compSigner = await getWhale(CompWhale);
    const swapAmount = parseUnits('100', 18); // 1000 comp tokens
    await IComp.connect(compSigner).transfer(vault.address, swapAmount);

    let compBalance = await IComp.balanceOf(vault.address);
    let usdcBalance = await IUSDc.balanceOf(vault.address);

    expect(compBalance).to.be.equal(swapAmount);
    expect(usdcBalance).to.be.equal(0);

    const tx = await vault.swapMinAmountOutMultiTest(
      swapAmount,
      getSwapDeadline(),
      0,
      compToken,
      usdc,
    );
    const receipt = await tx.wait();
    const { minAmountOut } = receipt.events!.at(-1)!.args as Result;

    // Low deadline so it should revert
    await expect(
      vault.swapTokensMultiTest(swapAmount, 1000, 0, compToken, usdc, false),
    ).to.be.revertedWith('Transaction too old');

    await vault.swapTokensMultiTest(swapAmount, getSwapDeadline(), 0, compToken, usdc, false);
    compBalance = await IComp.balanceOf(vault.address);
    usdcBalance = await IUSDc.balanceOf(vault.address);

    expect(usdcBalance).to.be.equal(minAmountOut);
    expect(compBalance).to.be.equal(0);
  });

  it('Swapping USDC to COMP and COMP back to USDC', async function () {
    const { vault, user } = await setupVault();
    const swapAmount = parseUSDC('10000');
    await IUSDc.connect(user).transfer(vault.address, swapAmount);
    const usdcBalance = await IUSDc.balanceOf(vault.address);
    // console.log(`USDC Balance vault: ${usdcBalance}`);

    await vault.swapTokensMultiTest(swapAmount, getSwapDeadline(), 0, usdc, compToken, false);

    const compBalance = await IComp.balanceOf(vault.address);
    // console.log(`Comp Balance vault: ${compBalance}`);

    // Atleast receive some COMP
    expect(formatUnits(compBalance, 18)).to.be.greaterThan(0);
    await vault.swapTokensMultiTest(compBalance, getSwapDeadline(), 0, compToken, usdc, false);

    // console.log(`USDC Balance vault End: ${await IUSDc.balanceOf(vault.address)}`);
    const compBalanceEnd = await IComp.balanceOf(vault.address);
    const usdcBalanceEnd = await IUSDc.balanceOf(vault.address);

    // MultiHop swap fee is 0,6% => total fee = +- 1,2% => 10_000 * 1,2% = 120 fee
    expect(Number(formatUSDC(usdcBalanceEnd))).to.be.closeTo(10_000 - 120, 25);
    expect(compBalanceEnd).to.be.equal(0);
  });

  it('Should take into account token balance first', async function () {
    const { vault } = await setupVault();
    const compSigner = await getWhale(CompWhale);
    const USDCSigner = await getUSDCSigner();

    const compAmount = parseUnits('1000', 18); // 1000 comp tokens
    const swapAmount = parseUSDC('10000'); // 100 comp tokens

    // transfer comp and usdc to vault
    await Promise.all([
      IComp.connect(compSigner).transfer(vault.address, compAmount),
      IUSDc.connect(USDCSigner).transfer(vault.address, swapAmount),
    ]);

    // should use token balance in the vault instead of swapping, so balance should not change
    const compBalanceBefore = await IComp.balanceOf(vault.address);
    const usdcBalanceBefore = await IUSDc.balanceOf(vault.address);
    await vault.swapTokensMultiTest(swapAmount, getSwapDeadline(), 0, usdc, compToken, true);
    const compBalanceAfter = await IComp.balanceOf(vault.address);
    const usdcBalanceAfter = await IUSDc.balanceOf(vault.address);

    expect(compBalanceAfter - compBalanceBefore).to.be.equal(0);
    expect(usdcBalanceAfter - usdcBalanceBefore).to.be.equal(0);
  });
});
