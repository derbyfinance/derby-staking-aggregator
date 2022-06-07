/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, formatUSDC, getUSDCSigner, parseUnits, parseUSDC } from '../helpers/helpers';
import type { Controller, ETFVaultMock } from '../../typechain-types';
import { deployController, deployETFVaultMock } from '../helpers/deploy';
import { usdc, starterProtocols as protocols } from "../helpers/addresses";
import { initController } from "../helpers/vaultHelpers";
import AllMockProviders from "../helpers/allMockProvidersClass";
import { ethers } from "hardhat";
import { ProtocolVault } from "@testhelp/protocolVaultClass";
import { vaultInfo } from "../helpers/vaultHelpers";


const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, ETFnumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing ETFVault, unit test", async () => {
  let vault: ETFVaultMock, controller: Controller, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string;

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    await Promise.all([
      initController(controller, [userAddr, vault.address]),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, ETFnumber, AllMockProviders);
      await protocol.resetAllocation(vault);
    }
  });

  it("Deposit, mint and return Xaver LP tokens", async function() {
    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;
    
    console.log(`-------------Depositing 9k-------------`)
    const amountUSDC = parseUSDC('9000');
    await Promise.all([
      compoundVault.setCurrentAllocation(vault, 40),
      aaveVault.setCurrentAllocation(vault, 60),
      yearnVault.setCurrentAllocation(vault, 20),
    ]);
    await vault.depositETF(userAddr, amountUSDC);

    const LPBalanceUser = await vault.balanceOf(userAddr);
    expect(LPBalanceUser).to.be.equal(amountUSDC);

    console.log(`Mocking a rebalance with the 9k deposit => 3k to each protocol`);
    const mockedBalance = parseUSDC('3000'); // 3k in each protocol
    const mockedBalanceComp = parseUnits('3000', 8); // 3k in each protocol

    await Promise.all([
      vault.clearCurrencyBalance(parseUSDC('9000')),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalanceComp),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance),
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance),
    ]);

    await vault.depositETF(userAddr, parseUSDC('1000'));
    const exchange = await vault.exchangeRate();
    
    // expect LP Token balance User == 9k + 1k because Expect price == 1 i.e 1:1
    expect(await vault.exchangeRate()).to.be.equal(parseUSDC('1'));
    expect(await vault.balanceOf(userAddr)).to.be.equal(amountUSDC.add(parseUSDC('1000')));
    
    console.log(`Mocking a profit of 100 in each protocol with 1k sitting in vault`);
    const profit = parseUSDC('100');
    const profitComp = parseUnits('100', 8);

    await Promise.all([
      compoundProvider.mock.balanceUnderlying.returns(mockedBalanceComp.add(profitComp)),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
    ]);

    // 300 profit on 9k + 1k = 3% => Exchange route should be 1.03
    expect(await vault.exchangeRate()).to.be.equal(parseUSDC('1.03'));

    console.log(`Depositing 500 into the vault`);
    const LPBalanceBefore = await vault.balanceOf(userAddr);
    await vault.depositETF(userAddr, parseUSDC('500'));
    // Expected shares to receive = 500 / 1.03 = 485.43
    const expectedShares = 500 / 1.03;
    const sharesReceived = formatUSDC((await vault.balanceOf(userAddr)).sub(LPBalanceBefore));
    expect(Number(sharesReceived)).to.be.closeTo(expectedShares, 0.01);
  });

});

