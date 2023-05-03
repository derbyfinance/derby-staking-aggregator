import { expect } from 'chai';
import { Contract } from 'ethers';
import { erc20, formatUSDC, formatUnits, parseUSDC, parseUnits } from '@testhelp/helpers';
import { usdc, starterProtocols as protocols, compoundUSDC, yearnUSDC } from '@testhelp/addresses';
import { setupVault } from './setup';
import { getDeployConfigVault } from '@testhelp/deployHelpers';

describe('Testing Vault, unit test', async () => {
  const IUSDc: Contract = erc20(usdc),
    vaultNumber: number = 10;

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  const amount = 100_000;
  const amountUSDC = parseUSDC(amount.toString());

  it('Deposit and withdraw partially from compoundUSDC', async function () {
    const { vault, controller, user, guardian } = await setupVault();
    const CUSDc: Contract = erc20(compoundUSDC);

    await vault.connect(user).deposit(amountUSDC, await user.getAddress());

    await vault.depositInProtocolTest(compoundVault.number, parseUSDC(10_000));
    let balanceUnderlying = formatUSDC(await vault.balanceUnderlying(compoundVault.number));
    expect(balanceUnderlying).to.be.closeTo(10_000, 1);

    let expectedShares = await vault.calcShares(compoundVault.number, parseUSDC(10_000));
    expect(formatUnits(expectedShares, 8)).to.be.closeTo(
      formatUnits(await CUSDc.balanceOf(vault.address), 8),
      1,
    );

    const expectedPrice = parseUnits(10_000, 6 + 18).div(await CUSDc.balanceOf(vault.address));
    const price = await vault.price(compoundVault.number);
    expect(formatUnits(expectedPrice, 8)).to.be.closeTo(formatUnits(price, 8), 1);
    console.log({ expectedShares });
    console.log({ expectedPrice });
    console.log({ price });

    await vault.withdrawFromProtocolTest(compoundVault.number, parseUSDC(2_000));
    balanceUnderlying = formatUSDC(await vault.balanceUnderlying(compoundVault.number));
    expect(balanceUnderlying).to.be.closeTo(10_000 - 2_000, 1);

    expectedShares = await vault.calcShares(compoundVault.number, parseUSDC(10_000 - 2_000));
    expect(formatUnits(expectedShares, 8)).to.be.closeTo(
      formatUnits(await CUSDc.balanceOf(vault.address), 8),
      1,
    );

    // await vault.withdrawFromProtocolTest(compoundVault.number, parseUSDC(1_000));
    // const balance1 = await vault.balanceUnderlying(compoundVault.number);
    // console.log(`Balance in compoundVault after withdraw ${balance1}`);

    // console.log(`vault balance after ${await IUSDc.balanceOf(vault.address)}`);
  });

  it('Deposit and withdraw partially from yearnUSDC', async function () {
    const { vault, controller, user, guardian } = await setupVault();
    const YUSDc: Contract = erc20(yearnUSDC);

    await vault.connect(user).deposit(amountUSDC, await user.getAddress());

    await vault.depositInProtocolTest(yearnVault.number, parseUSDC(10_000));
    let balanceUnderlying = formatUSDC(await vault.balanceUnderlying(yearnVault.number));
    expect(balanceUnderlying).to.be.closeTo(10_000, 1);

    let expectedShares = await vault.calcShares(yearnVault.number, parseUSDC(10_000));
    expect(formatUnits(expectedShares, 6)).to.be.closeTo(
      formatUnits(await YUSDc.balanceOf(vault.address), 6),
      1,
    );

    await vault.withdrawFromProtocolTest(yearnVault.number, parseUSDC(2_000));
    balanceUnderlying = formatUSDC(await vault.balanceUnderlying(yearnVault.number));
    expect(balanceUnderlying).to.be.closeTo(10_000 - 2_000, 1);

    expectedShares = await vault.calcShares(yearnVault.number, parseUSDC(10_000 - 2_000));
    expect(formatUnits(expectedShares, 6)).to.be.closeTo(
      formatUnits(await YUSDc.balanceOf(vault.address), 6),
      1,
    );
  });
});
// 99999999
