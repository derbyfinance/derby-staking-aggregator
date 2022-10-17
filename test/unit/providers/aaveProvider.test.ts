import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, controllerAddProtocol } from '@testhelp/helpers';
import type { AaveProvider, Controller } from '@typechain';
import { deployAaveProvider, deployController } from '@testhelp/deploy';
import { usdc, aaveUSDC as ausdc, aave } from '@testhelp/addresses';

const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());
const ETFnumber = 0;

describe.skip('Testing Aave provider', async () => {
  let aaveProvider: AaveProvider,
    controller: Controller,
    dao: Signer,
    vault: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    aToken: Contract,
    daoAddr: string,
    vaultAddr: string,
    protocolNumber: number;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, aaveProvider, USDCSigner, IUSDc, aToken] = await Promise.all([
      vault.getAddress(),
      deployAaveProvider(dao, controller.address),
      getUSDCSigner(),
      erc20(usdc),
      erc20(ausdc),
    ]);

    // Transfer and approve USDC to vault AND add protocol to controller contract
    [protocolNumber] = await Promise.all([
      controllerAddProtocol(
        controller,
        'aave_usdc_01',
        ETFnumber,
        aaveProvider.address,
        ausdc,
        usdc,
        aave,
        (1e6).toString(),
      ),
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(aaveProvider.address, amountUSDC),
    ]);
  });

  it('Should deposit and withdraw to Aave through controller', async function () {
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await controller.connect(vault).deposit(ETFnumber, protocolNumber, vaultAddr, amountUSDC);

    const aTokenbalance = await aaveProvider.balance(vaultAddr, ausdc);
    expect(Number(formatUSDC(aTokenbalance))).to.be.closeTo(amount, 1);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);
    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.be.closeTo(aTokenbalance, 1e6);

    console.log(`-------------------------Withdraw-------------------------`);
    await aToken.connect(vault).approve(aaveProvider.address, aTokenbalance);
    await controller.connect(vault).withdraw(ETFnumber, protocolNumber, vaultAddr, aTokenbalance);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10);
  });

  it('Should fail when !controller is calling the Provider', async function () {
    await expect(aaveProvider.connect(vault).deposit(vaultAddr, amountUSDC, ausdc, usdc)).to.be.revertedWith(
      'ETFProvider: only controller',
    );
  });

  it('Should fail when !Vault is calling the controller', async function () {
    await expect(controller.deposit(ETFnumber, protocolNumber, vaultAddr, amountUSDC)).to.be.revertedWith(
      'Controller: only Vault',
    );
  });

  it('Should get exchangeRate through controller', async function () {
    const exchangeRate = await controller.connect(vault).exchangeRate(ETFnumber, protocolNumber);
    console.log(`Exchange rate ${exchangeRate}`);
  });
});
