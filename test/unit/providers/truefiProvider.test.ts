import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
  getUSDCSigner,
  erc20,
  formatUSDC,
  parseUSDC,
  controllerAddProtocol,
} from '@testhelp/helpers';
import type { TruefiProvider, Controller } from '@typechain';
import { deployTruefiProvider, deployController } from '@testhelp/deploy';
import { usdc, truefiUSDC as tusdc, truefi } from '@testhelp/addresses';

const amount = Math.floor(Math.random() * 100000);
// const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const ETFnumber = 0;

describe.skip('Testing TrueFi provider', async () => {
  let truefiProvider: TruefiProvider,
    controller: Controller,
    dao: Signer,
    vault: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    tToken: Contract,
    daoAddr: string,
    vaultAddr: string;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, truefiProvider, USDCSigner, IUSDc, tToken] = await Promise.all([
      vault.getAddress(),
      deployTruefiProvider(dao),
      getUSDCSigner(),
      erc20(usdc),
      erc20(tusdc),
    ]);

    // Transfer and approve USDC to vault AND add protocol to controller contract
    await Promise.all([
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(truefiProvider.address, amountUSDC),
    ]);
  });

  it('Should deposit and withdraw to Truefi through controller', async function () {
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await truefiProvider.connect(vault).deposit(amountUSDC, tusdc, usdc);
    const balanceShares = await truefiProvider.balance(vaultAddr, tusdc);
    const balanceUnderlying = await truefiProvider.balanceUnderlying(vaultAddr, tusdc);
    const calcShares = await truefiProvider.calcShares(balanceUnderlying, tusdc);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(calcShares).to.be.closeTo(balanceShares, 2);
    expect(balanceUnderlying).to.be.closeTo(amountUSDC, 2);
    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(amountUSDC);

    console.log(`-------------------------Withdraw-------------------------`);
    await tToken.connect(vault).approve(truefiProvider.address, balanceShares);
    await truefiProvider.connect(vault).withdraw(balanceShares, tusdc, usdc);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    expect(Number(formatUSDC(vaultBalanceEnd))).to.be.closeTo(
      Number(formatUSDC(vaultBalanceStart)),
      amount * 0.022,
    ); // 2% fee on withdraw Truefi
  });
});
