import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract } from 'ethers';

import type { Controller, MainVaultMock } from '@typechain';
import { erc20, getUSDCSigner, parseUSDC } from '@testhelp/helpers';
import { deployController, deployMainVaultMock } from '@testhelp/deploy';
import { usdc } from '@testhelp/addresses';
import { initController } from '@testhelp/vaultHelpers';
import AllMockProviders from '@testhelp/allMockProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';

const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe('Testing VaultDeposit, unit test', async () => {
  let vault: MainVaultMock,
    controller: Controller,
    dao: Signer,
    user: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string;

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
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);
  });

  it('Deposit, mint and return Derby LP tokens', async function () {
    await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
      vault,
      user,
      10_000 * 1e6,
    );

    // mocking exchangerate to 0.9
    await vault.setExchangeRateTEST(0.9 * 1e6);

    let expectedLPTokens = Math.trunc((10_000 / 0.9) * 1e6);
    await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
      vault,
      user,
      expectedLPTokens,
    );

    // mocking exchangerate to 1.321
    await vault.setExchangeRateTEST(1.321 * 1e6);

    expectedLPTokens = Math.trunc((10_000 / 1.321) * 1e6);
    await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
      vault,
      user,
      expectedLPTokens,
    );
  });

  it('Should not be able to deposit when vault is off', async function () {
    await vault.toggleVaultOnOffTEST(true);

    await expect(vault.connect(user).deposit(10_000 * 1e6)).to.be.revertedWith('Vault is off');
  });
});
