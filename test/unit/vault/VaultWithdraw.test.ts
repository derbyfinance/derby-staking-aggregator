import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";

import type { Controller, MainVaultMock } from '@typechain';
import { erc20, formatUSDC, getUSDCSigner, parseUSDC } from '@testhelp/helpers';
import { deployController, deployMainVaultMock } from '@testhelp/deploy';
import { usdc } from "@testhelp/addresses";
import { initController } from "@testhelp/vaultHelpers";
import AllMockProviders from "@testhelp/allMockProvidersClass";
import { vaultInfo } from "@testhelp/vaultHelpers";


const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing VaultWithdraw, unit test", async () => {
  let vault: MainVaultMock, controller: Controller, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployMainVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    await Promise.all([
      initController(controller, [userAddr, vault.address]),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);
  });

  it("Should set withdrawal request and withdraw the allowance later", async function() {
    await vault.connect(user).deposit(parseUSDC('10000')); // 10k
    expect(await vault.totalSupply()).to.be.equal(parseUSDC('10000')); // 10k

    // withdrawal request for more then LP token balance
    await expect(vault.connect(user).withdrawalRequest(parseUSDC('10001')))
      .to.be.revertedWith('ERC20: burn amount exceeds balance');

    // withdrawal request for 10k LP tokens
    await expect(() => vault.connect(user).withdrawalRequest(parseUSDC('10000')))
      .to.changeTokenBalance(vault, user, - parseUSDC('10000'));
    
    // check withdrawalAllowance user and totalsupply
    expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(parseUSDC('10000'));
    expect(await vault.totalSupply()).to.be.equal(parseUSDC('0'));

    // trying to withdraw allowance before the vault reserved the funds
    await expect(vault.connect(user).withdrawAllowance())
      .to.be.revertedWith('Funds not reserved yet');

    // mocking vault settings, exchangerate to 0.9
    await Promise.all([
      vault.upRebalancingPeriodTEST(),
      vault.setExchangeRateTEST(2, parseUSDC('0.9')),
      vault.setReservedFundsTEST(parseUSDC('10000')),
    ]);

    // withdraw allowance should give 9k USDC
    await expect(() => vault.connect(user).withdrawAllowance())
      .to.changeTokenBalance(IUSDc, user, parseUSDC('9000'));

    // trying to withdraw allowance again
    await expect(vault.connect(user).withdrawAllowance())
      .to.be.revertedWith('No allowance');
  });
});
