/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC } from './helpers/helpers';
import { getAndLogBalances } from "./helpers/vaultHelpers";
import type { ETFVaultMock } from '../typechain-types';
import { MockContract } from "ethereum-waffle";
import { setDeltaAllocations, setCurrentAllocations } from "./helpers/vaultHelpers";
import { beforeEachETFVault, Protocol } from "./helpers/vaultBeforeEach";

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const marginScale = 1E9;
const uScale = 1E6;
const liquidityPerc = 10;
const performancePerc = 10;
const amount = 100000;
const amountUSDC = parseUSDC(amount.toString());

describe("Deploy Contracts and interact with Vault", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  yearnProvider: MockContract, 
  compoundProvider: MockContract, 
  aaveProvider: MockContract,
  allProtocols: Protocol[],
  router: Contract;

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      ,
      allProtocols,
      IUSDc,
      yearnProvider, 
      compoundProvider, 
      aaveProvider
    ] = await beforeEachETFVault(amountUSDC, true);
  });

  it("Should calculate performance fee correctly", async function() {
    await setCurrentAllocations(vaultMock, allProtocols); // only used to make sure getTotalUnderlying returns > 0
    await setDeltaAllocations(user, vaultMock, allProtocols); // only used to make sure the totalCurrentBalance calculation inside rebalanceETF returns > 0
    await vaultMock.depositETF(userAddr, amountUSDC); // only used to make sure totalSupply (LP tokens) returns > 0

    console.log("Set mock functions");
    const mockedBalance = parseUSDC('1000'); // 3k in each protocol

    await Promise.all([
        // vaultMock.clearCurrencyBalance(parseUSDC('9000')),
        yearnProvider.mock.balanceUnderlying.returns(mockedBalance),
        compoundProvider.mock.balanceUnderlying.returns(mockedBalance),
        aaveProvider.mock.balanceUnderlying.returns(mockedBalance),
        yearnProvider.mock.deposit.returns(mockedBalance),
        compoundProvider.mock.deposit.returns(mockedBalance),
        aaveProvider.mock.deposit.returns(mockedBalance),
        yearnProvider.mock.withdraw.returns(mockedBalance),
        compoundProvider.mock.withdraw.returns(mockedBalance),
        aaveProvider.mock.withdraw.returns(mockedBalance),
    ]);

    await vaultMock.rebalanceETF();
    console.log("old ex rate: %s", await vaultMock.exchangeRate());
    let totalUnderlying = Number(formatUSDC(await vaultMock.getTotalUnderlying()));
    let totalLiquidity = Number(formatUSDC(await IUSDc.balanceOf(vaultMock.address)));
    const totalBefore = totalUnderlying + totalLiquidity;

    // bump up the underlying balances to simulate a profit being made
    const profit = parseUSDC('1000');
    await Promise.all([
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
    ]);
    await setDeltaAllocations(user, vaultMock, allProtocols);
    const performanceFee = Number(formatUSDC(await vaultMock.calculatePerformanceFee()));
    console.log("performanceFee: %s", performanceFee);
    await vaultMock.rebalanceETF();
    totalUnderlying = Number(formatUSDC(await vaultMock.getTotalUnderlying()));
    totalLiquidity = Number(formatUSDC(await IUSDc.balanceOf(vaultMock.address)));
    const totalAfter = totalUnderlying + totalLiquidity;

    // (totalAfter - totalBefore) / totalBefore x totalUnderlying x performancePerc
    expect(Math.floor((totalAfter - totalBefore) / totalBefore * totalUnderlying * performancePerc/100 * uScale)).to.be.closeTo((performanceFee) * uScale, 1);
  });

});