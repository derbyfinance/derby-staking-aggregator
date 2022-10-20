import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract } from 'ethers';

import type { Controller, MainVaultMock } from '@typechain';
import { erc20, formatEther, getUSDCSigner, parseEther, parseUSDC } from '@testhelp/helpers';
import { deployController, deployMainVaultMock } from '@testhelp/deploy';
import { usdc, starterProtocols as protocols } from '@testhelp/addresses';
import { initController, rebalanceETF } from '@testhelp/vaultHelpers';
import allProviders from '@testhelp/allProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';

const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;
const uniswapToken = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';

describe('Testing VaultWithdraw, unit test', async () => {
  let vault: MainVaultMock,
    controller: Controller,
    dao: Signer,
    user: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string;

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  beforeEach(async function () {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
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
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, allProviders);
    }
  });

  it('Should not be able to withdraw when vault is off', async function () {
    await vault.toggleVaultOnOffTEST(true);

    await expect(vault.connect(user).withdraw(1 * 1e6, false)).to.be.revertedWith('Vault is off');
    await vault.toggleVaultOnOffTEST(false);
  });

  it('Should be able to withdraw LP tokens from vault balance', async function () {
    // 100k USDC to vault
    await IUSDc.connect(USDCSigner).transfer(vault.address, 100_000 * 1e6);
    // deposit 10k USDC
    await vault.connect(user).deposit(50_000 * 1e6);

    await expect(() => vault.connect(user).withdraw(10_000 * 1e6, false)).to.changeTokenBalance(
      IUSDc,
      user,
      10_000 * 1e6,
    );

    // mocking exchangerate to 1.05
    await vault.setExchangeRateTEST(1.05 * 1e6);

    let expectedUSDCReceived = 10_000 * 1.05 * 1e6;
    await expect(() => vault.connect(user).withdraw(10_000 * 1e6, false)).to.changeTokenBalance(
      IUSDc,
      user,
      expectedUSDCReceived,
    );

    // mocking exchangerate to 1.05
    await vault.setExchangeRateTEST(1.2 * 1e6);

    expectedUSDCReceived = 30_000 * 1.2 * 1e6;
    await expect(() => vault.connect(user).withdraw(30_000 * 1e6, false)).to.changeTokenBalance(
      IUSDc,
      user,
      expectedUSDCReceived,
    );
  });

  it.skip('Should be able to withdraw LP tokens from vault balance and protocols', async function () {
    await vault.connect(user).deposit(100_000 * 1e6);

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, dao, 40 * 1e6),
      aaveVault.setDeltaAllocation(vault, dao, 60 * 1e6),
      yearnVault.setDeltaAllocation(vault, dao, 20 * 1e6),
    ]);

    // mocking vault in correct state and exchangerate to 1.05
    await Promise.all([
      vault.setExchangeRateTEST(1.05 * 1e6),
      vault.setVaultState(3),
      vault.setDeltaAllocationsReceivedTEST(true),
    ]);
    await rebalanceETF(vault);
    await vault.setVaultState(0);

    await expect(vault.connect(user).withdraw(20_000 * 1e6, false)).to.be.revertedWith(
      'Not enough funds',
    );

    let expectedUSDCReceived = 20_000 * 1.05 * 1e6;
    await expect(() => vault.connect(user).withdraw(20_000 * 1e6, true)).to.changeTokenBalance(
      IUSDc,
      user,
      expectedUSDCReceived,
    );

    // mocking exchangerate to 1.8
    await vault.setExchangeRateTEST(1.8 * 1e6);

    expectedUSDCReceived = 30_000 * 1.8 * 1e6;
    await expect(() => vault.connect(user).withdraw(30_000 * 1e6, true)).to.changeTokenBalance(
      IUSDc,
      user,
      expectedUSDCReceived,
    );

    // expected LP token balance = 100k - 20k - 30k = 50k
    expect(await vault.balanceOf(userAddr)).to.be.equal(50_000 * 1e6);
  });

  it.skip('Should set withdrawal request and withdraw the allowance later', async function () {
    await vault.connect(user).deposit(parseUSDC('10000')); // 10k
    expect(await vault.totalSupply()).to.be.equal(parseUSDC('10000')); // 10k

    // mocking exchangerate to 0.9
    await vault.setExchangeRateTEST(parseUSDC('0.9'));

    // withdrawal request for more then LP token balance
    await expect(vault.connect(user).withdrawalRequest(parseUSDC('10001'))).to.be.revertedWith(
      'ERC20: burn amount exceeds balance',
    );

    // withdrawal request for 2 x 5k LP tokens
    await expect(() =>
      vault.connect(user).withdrawalRequest(parseUSDC('5000')),
    ).to.changeTokenBalance(vault, user, -parseUSDC('5000'));
    await expect(() =>
      vault.connect(user).withdrawalRequest(parseUSDC('5000')),
    ).to.changeTokenBalance(vault, user, -parseUSDC('5000'));

    // check withdrawalAllowance user and totalsupply
    expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(parseUSDC('9000'));
    expect(await vault.totalSupply()).to.be.equal(parseUSDC('0'));

    // trying to withdraw allowance before the vault reserved the funds
    await expect(vault.connect(user).withdrawAllowance(false)).to.be.revertedWith('');

    // mocking vault settings
    await vault.upRebalancingPeriodTEST();
    await vault.setReservedFundsTEST(parseUSDC('10000'));

    // trying to do another withdrawal request after rebalancing
    await vault.connect(user).deposit(parseUSDC('5000')); // 10k
    await expect(vault.connect(user).withdrawalRequest(parseUSDC('5000'))).to.be.revertedWith(
      'Withdraw allowance first',
    );

    // withdraw allowance should give 9k USDC
    await expect(() => vault.connect(user).withdrawAllowance(false)).to.changeTokenBalance(
      IUSDc,
      user,
      parseUSDC('9000'),
    );

    // trying to withdraw allowance again
    await expect(vault.connect(user).withdrawAllowance(false)).to.be.revertedWith('No allowance');
  });

  it('Should swap rewards to UNI tokens', async function () {
    const IUniswap = erc20(uniswapToken);

    await Promise.all([vault.setDaoToken(uniswapToken), vault.setExchangeRateTEST(parseUSDC('1'))]);

    await vault.connect(user).deposit(parseUSDC('10000')); // 10k

    await expect(() =>
      vault.connect(user).withdrawalRequest(parseUSDC('10000')),
    ).to.changeTokenBalance(vault, user, -parseUSDC('10000'));

    await Promise.all([
      vault.upRebalancingPeriodTEST(),
      vault.setReservedFundsTEST(parseUSDC('10000')),
    ]);

    // Uniswap token is about $8, so should receive atleast 10_000 / 8 = 1250
    await vault.connect(user).withdrawAllowance(true);
    const balance = formatEther(await IUniswap.balanceOf(userAddr));

    expect(Number(balance)).to.be.greaterThan(1250);
  });
});
