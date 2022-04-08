/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC } from './helpers/helpers';
import { getAndLogBalances, rebalanceETF , setDeltaAllocations, setCurrentAllocations } from "./helpers/vaultHelpers";
import type { ETFVaultMock } from '../typechain-types';
import { MockContract } from "ethereum-waffle";
import { beforeEachETFVault, Protocol } from "./helpers/vaultBeforeEach";

const name = 'XaverUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const marginScale = 1E9;
const uScale = 1E6;
const liquidityPerc = 10;
const performancePerc = 10;
const amount = 1_000_000;
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

  const mockedBalance = parseUSDC('10000'); // 3k in each protocol
  const exchangeRate = 10;

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

    await setCurrentAllocations(vaultMock, allProtocols); // only used to make sure getTotalUnderlying returns > 0
    await setDeltaAllocations(user, vaultMock, allProtocols); // only used to make sure the totalCurrentBalance calculation inside rebalanceETF returns > 0
    await vaultMock.depositETF(userAddr, amountUSDC); // only used to make sure totalSupply (LP tokens) returns > 0

    console.log("Set mock functions");

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
        yearnProvider.mock.exchangeRate.returns(exchangeRate),
        compoundProvider.mock.exchangeRate.returns(exchangeRate + 10),
        aaveProvider.mock.exchangeRate.returns(exchangeRate + 20),
    ]);
  });

  it("Should calculate performance fee correctly", async function() {
    let gasUsed = formatUSDC(await rebalanceETF(vaultMock));
    console.log({gasUsed})
    let totalUnderlying = Number(formatUSDC(await vaultMock.getTotalUnderlying()));
    let totalLiquidity = Number(formatUSDC(await IUSDc.balanceOf(vaultMock.address)));
    const totalBefore = totalUnderlying + totalLiquidity;

    console.log({totalLiquidity})
    // hence this value is used to later substract from the result.

    // bump up the underlying balances to simulate a profit being made
    const profit = parseUSDC('10000');
    await Promise.all([
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
    ]);
    await setDeltaAllocations(user, vaultMock, allProtocols);
    const performanceFee = Number(formatUSDC(await vaultMock.calculatePerformanceFee()));
    console.log("performanceFee: %s", performanceFee);
    gasUsed = formatUSDC(await rebalanceETF(vaultMock));
    console.log({gasUsed})
    totalUnderlying = Number(formatUSDC(await vaultMock.getTotalUnderlying()));
    totalLiquidity = Number(formatUSDC(await IUSDc.balanceOf(vaultMock.address)));
    const totalAfter = totalUnderlying + totalLiquidity;

    console.log({totalLiquidity})

    // (totalAfter - totalBefore) / totalBefore x totalUnderlying x performancePerc
    expect(Math.floor((totalAfter - totalBefore) / totalBefore * totalUnderlying * performancePerc/100)).to.be.closeTo((performanceFee), 1);
  });

  it.only("Should store historical prices of protocols on each rebalance", async function() {
    await rebalanceETF(vaultMock);

    expect(await vaultMock.getHistoricalPrice(0, 0)).to.be.equal(20);
    expect(await vaultMock.getHistoricalPrice(2, 0)).to.be.equal(30);
    expect(await vaultMock.getHistoricalPrice(4, 0)).to.be.equal(10);

    await setDeltaAllocations(user, vaultMock, allProtocols); // only used to make sure the totalCurrentBalance calculation inside rebalanceETF returns > 0
    await Promise.all([
      yearnProvider.mock.exchangeRate.returns(exchangeRate * 2),
      compoundProvider.mock.exchangeRate.returns((exchangeRate + 10) * 2),
      aaveProvider.mock.exchangeRate.returns((exchangeRate + 20) * 2)
    ]);
    await rebalanceETF(vaultMock);

    expect(await vaultMock.getHistoricalPrice(0, 1)).to.be.equal(40);
    expect(await vaultMock.getHistoricalPrice(2, 1)).to.be.equal(60);
    expect(await vaultMock.getHistoricalPrice(4, 1)).to.be.equal(20);
  });
});