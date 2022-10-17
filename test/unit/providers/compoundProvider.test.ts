import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { getUSDCSigner, erc20, parseUSDC, getWhale, controllerAddProtocol } from '@testhelp/helpers';
import type { CompoundProviderMock, Controller } from '@typechain';
import { deployCompoundProviderMock, deployController } from '@testhelp/deploy';
import { usdc, compoundUSDC as cusdc, comptroller, compToken as compTokenAddr } from '@testhelp/addresses';

const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());
const cusdcWhaleAddr = '0xabde2f02fe84e083e1920471b54c3612456365ef';
const ETFnumber = 0;

describe.skip('Testing Compound provider', async () => {
  let compoundProviderMock: CompoundProviderMock,
    controller: Controller,
    dao: Signer,
    vault: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    cToken: Contract,
    daoAddr: string,
    vaultAddr: string,
    cusdcWhale: Signer,
    compToken: Contract,
    protocolNumber: number;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, compoundProviderMock, USDCSigner, cusdcWhale, IUSDc, cToken, compToken] = await Promise.all([
      vault.getAddress(),
      deployCompoundProviderMock(dao, controller.address, comptroller),
      getUSDCSigner(),
      getWhale(cusdcWhaleAddr),
      erc20(usdc),
      erc20(cusdc),
      erc20(compTokenAddr),
    ]);

    // Transfer and approve USDC to vault AND add protocol to controller contract
    [protocolNumber] = await Promise.all([
      controllerAddProtocol(
        controller,
        'compound_usdc_01',
        ETFnumber,
        compoundProviderMock.address,
        cusdc,
        usdc,
        compTokenAddr,
        (1e6).toString(),
      ),
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(compoundProviderMock.address, amountUSDC),
      controller.setClaimable(compoundProviderMock.address, true),
    ]);
  });

  it('Should deposit and withdraw to Compound through controller', async function () {
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumber, vaultAddr, amountUSDC);
    const balanceShares = Number(await compoundProviderMock.balance(vaultAddr, cusdc));
    const price = Number(await compoundProviderMock.exchangeRate(cusdc));
    const amount = (balanceShares * price) / 1e18;

    expect(amount).to.be.closeTo(Number(amountUSDC), 2);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);

    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.equal(Number(amountUSDC));

    console.log(`-------------------------Withdraw-------------------------`);
    console.log(`balance shares ${balanceShares}`);

    await cToken.connect(vault).approve(compoundProviderMock.address, balanceShares);
    await controller.connect(vault).withdraw(ETFnumber, protocolNumber, vaultAddr, balanceShares);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);

    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.be.closeTo(Number(amountUSDC), 2);
  });

  it('Should claim Comp tokens from Comptroller', async function () {
    await controller.connect(vault).claim(ETFnumber, protocolNumber);

    const compBalanceBefore = Number(await compToken.balanceOf(cusdcWhaleAddr));
    await compoundProviderMock.connect(cusdcWhale).claimTest(cusdcWhaleAddr, cusdc);
    const compBalanceAfter = Number(await compToken.balanceOf(cusdcWhaleAddr));

    console.log(`Balance Before ${compBalanceBefore}`);
    console.log(`Balance After ${compBalanceAfter}`);

    expect(compBalanceAfter).to.be.greaterThan(compBalanceBefore);
  });

  it('Should fail when !controller is calling the Provider', async function () {
    await expect(compoundProviderMock.connect(vault).deposit(vaultAddr, amountUSDC, usdc, cusdc)).to.be.revertedWith(
      'ETFProvider: only controller',
    );
  });

  it('Should fail when !Vault is calling the controller', async function () {
    await expect(controller.deposit(ETFnumber, protocolNumber, vaultAddr, amountUSDC)).to.be.revertedWith(
      'Controller: only Vault',
    );
  });

  it('Should get Compound exchangeRate through controller', async function () {
    const exchangeRate = await controller.connect(vault).exchangeRate(ETFnumber, protocolNumber);
    console.log(`Exchange rate ${exchangeRate}`);
  });
});
