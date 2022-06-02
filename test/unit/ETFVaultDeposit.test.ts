/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { formatUSDC, parseUnits, parseUSDC } from '../helpers/helpers';
import type { ETFVaultMock } from '../../typechain-types';
import { MockContract } from "ethereum-waffle";
import { setCurrentAllocations } from "../helpers/vaultHelpers";
import { beforeEachETFVault, Protocol } from "../helpers/vaultBeforeEach";

const amountUSDC = parseUSDC('100000'); // 100k

describe("Testing ETFVaultDeposit", async () => {
  let yearnProvider: MockContract, 
  compoundProvider: MockContract, 
  aaveProvider: MockContract, 
  vaultMock: ETFVaultMock,
  userAddr: string,
  allProtocols: Protocol[];

  beforeEach(async function() {
    [
      vaultMock,
      ,
      userAddr,
      ,
      allProtocols,
      ,
      yearnProvider, 
      compoundProvider, 
      aaveProvider
    ] = await beforeEachETFVault(amountUSDC, true);
  });

  it("Deposit, mint and return Xaver LP tokens", async function() {
    console.log(`-------------Depositing 9k-------------`)
    const amountUSDC = parseUSDC('9000');
    await setCurrentAllocations(vaultMock, allProtocols); 
    await vaultMock.depositETF(userAddr, amountUSDC);

    const LPBalanceUser = await vaultMock.balanceOf(userAddr);
    expect(LPBalanceUser).to.be.equal(amountUSDC);

    console.log(`Mocking a rebalance with the 9k deposit => 3k to each protocol`);
    const mockedBalance = parseUSDC('3000'); // 3k in each protocol
    const mockedBalanceComp = parseUnits('3000', 8); // 3k in each protocol

    await Promise.all([
      vaultMock.clearCurrencyBalance(parseUSDC('9000')),
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalanceComp),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance),
    ]);
    await vaultMock.depositETF(userAddr, parseUSDC('1000'));
    const exchange = await vaultMock.exchangeRate();
    console.log({exchange})
    
    // expect LP Token balance User == 9k + 1k because Expect price == 1 i.e 1:1
    expect(await vaultMock.exchangeRate()).to.be.equal(parseUSDC('1'));
    expect(await vaultMock.balanceOf(userAddr)).to.be.equal(amountUSDC.add(parseUSDC('1000')));
    
    console.log(`Mocking a profit of 100 in each protocol with 1k sitting in vault`);
    const profit = parseUSDC('100');
    const profitComp = parseUnits('100', 8);

    await Promise.all([
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalanceComp.add(profitComp)),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
    ]);

    // 300 profit on 9k + 1k = 3% => Exchange route should be 1.03
    expect(await vaultMock.exchangeRate()).to.be.equal(parseUSDC('1.03'));

    console.log(`Depositing 500 into the vault`);
    const LPBalanceBefore = await vaultMock.balanceOf(userAddr);
    await vaultMock.depositETF(userAddr, parseUSDC('500'));
    // Expected shares to receive = 500 / 1.03 = 485.43
    const expectedShares = 500 / 1.03;
    const sharesReceived = formatUSDC((await vaultMock.balanceOf(userAddr)).sub(LPBalanceBefore));
    expect(Number(sharesReceived)).to.be.closeTo(expectedShares, 0.01);
  });

});

