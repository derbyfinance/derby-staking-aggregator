import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { getUSDCSigner, erc20, formatUSDC, parseUSDC } from '@testhelp/helpers';
import type { AaveProvider } from '@typechain';
import { deployAaveProvider } from '@testhelp/deploy';
import { usdc, aaveUSDC as ausdc, aave } from '@testhelp/addresses';

const amount = Math.floor(Math.random() * 100000);
const amountUSDC = parseUSDC(amount.toString());

describe.skip('Testing Aave provider', async () => {
  let aaveProvider: AaveProvider,
    dao: Signer,
    vault: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    aToken: Contract,
    daoAddr: string,
    vaultAddr: string;

  beforeEach(async function () {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();

    [vaultAddr, aaveProvider, USDCSigner, IUSDc, aToken] = await Promise.all([
      vault.getAddress(),
      deployAaveProvider(dao),
      getUSDCSigner(),
      erc20(usdc),
      erc20(ausdc),
    ]);

    // Transfer and approve USDC to vault AND add protocol to controller contract
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(aaveProvider.address, amountUSDC),
    ]);
  });

  it('Should deposit and withdraw to Aave through controller', async function () {
    console.log(`-------------------------Deposit-------------------------`);
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

    await aaveProvider.connect(vault).deposit(amountUSDC, ausdc, usdc);

    const aTokenbalance = await aaveProvider.balance(vaultAddr, ausdc);
    expect(Number(formatUSDC(aTokenbalance))).to.be.closeTo(amount, 1);

    const vaultBalance = await IUSDc.balanceOf(vaultAddr);
    expect(Number(vaultBalanceStart) - Number(vaultBalance)).to.be.closeTo(aTokenbalance, 1e6);

    console.log(`-------------------------Withdraw-------------------------`);
    await aToken.connect(vault).approve(aaveProvider.address, aTokenbalance);
    await aaveProvider.connect(vault).withdraw(aTokenbalance, ausdc, usdc);

    const vaultBalanceEnd = await IUSDc.balanceOf(vaultAddr);
    expect(vaultBalanceEnd).to.be.closeTo(vaultBalanceStart, 10);
  });

  it('Should get exchangeRate through controller', async function () {
    const exchangeRate = await aaveProvider.connect(vault).exchangeRate(ausdc);
    console.log(`Exchange rate ${exchangeRate}`);
  });
});
