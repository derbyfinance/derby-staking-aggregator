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

  it("Deposit, withdraw and burn Xaver LP Tokens", async function() {
    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;

    console.log(`-------------Depositing 9k-------------`)
    
    const amountUSDC = parseUSDC('9000');
    const startingBalance = await IUSDc.balanceOf(userAddr);
    await Promise.all([
      compoundVault.setCurrentAllocation(vault, 40),
      aaveVault.setCurrentAllocation(vault, 60),
      yearnVault.setCurrentAllocation(vault, 20),
    ]);
    await vault.connect(user).depositETF(amountUSDC);

    // LP balance should be 9k
    expect(await vault.balanceOf(userAddr)).to.be.equal(amountUSDC);
    expect(await vault.totalSupply()).to.be.equal(parseUSDC('9000'));

    console.log(`Mocking 0 balance in protocols => withdraw all funds (9k)`);
    const mockedBalance = parseUSDC('0');
    await Promise.all([
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalance),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance),
    ]);

    await vault.connect(user).withdrawETF(amountUSDC); // withdraw 9k == everything

    expect(await vault.totalSupply()).to.be.equal(0);
    expect(await vault.balanceOf(userAddr)).to.be.equal(0);
    expect(await IUSDc.balanceOf(userAddr)).to.be.equal(startingBalance);

    console.log(`Mocking 15k balance in protocols, with 300 Profit (so 15.9k totalUnderlying in protocols) each and 5k in Vault =>`);
    const mocked2Balance = parseUSDC('5000');
    const mockedBalanceComp = parseUnits('5000', 8);
    const profit = parseUSDC('300');
    const profitComp = parseUnits('300', 8);
    await vault.connect(user).depositETF(parseUSDC('20000'));

    expect(await IUSDc.balanceOf(userAddr)).to.be.equal(startingBalance.sub(parseUSDC('20000')));
    expect(Number(formatUSDC(await vault.totalSupply()))).to.be.equal(20_000);
    expect(Number(formatUSDC(await vault.balanceOf(userAddr)))).to.be.equal(20_000);
    expect(Number(formatUSDC(await IUSDc.balanceOf(vault.address)))).to.be.equal(20_000);

    // bumping the exchangerate up to 1.045
    await Promise.all([
      vault.clearCurrencyBalance(parseUSDC('15000')),
      yearnProvider.mock.balanceUnderlying.returns(mocked2Balance.add(profit)),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalanceComp.add(profitComp)),
      aaveProvider.mock.balanceUnderlying.returns(mocked2Balance.add(profit)),
    ]);
 
    await vault.connect(user).withdrawETF(parseUSDC('2000')); 

    expect(await vault.totalSupply()).to.be.equal(parseUSDC('18000')); // TS == 20k - 2k
    expect(await vault.balanceOf(userAddr)).to.be.equal(parseUSDC('18000')); // LP balance == 20k - 2k
    expect(await vault.exchangeRate()).to.be.equal(parseUSDC('1.045')) // 900 profit == 900 / 20k = 4,5% 
    // withdraw 2000 LP = 2000 x 1.045 => 2090 usdc
    // EndBalance = StartingBalance - 20k + 2000 + 90 profit 
    expect(await IUSDc.balanceOf(userAddr)).to.be.equal(startingBalance.sub(parseUSDC('20000')).add(parseUSDC('2090')));
  });

});
