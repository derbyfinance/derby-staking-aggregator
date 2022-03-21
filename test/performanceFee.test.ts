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
      ,
      yearnProvider, 
      compoundProvider, 
      aaveProvider
    ] = await beforeEachETFVault(amountUSDC, true);
  });

  it.only("Should calculate performance fee correctly", async function() {
    // await setDeltaAllocations(user, vaultMock, allProtocols);
    await setCurrentAllocations(vaultMock, allProtocols);
    await vaultMock.depositETF(userAddr, amountUSDC);

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
    console.log("total balance: %s", await vaultMock.getTotalUnderlying());
    await getAndLogBalances(vaultMock, allProtocols);
    let performanceFee = await vaultMock.performanceFee();
    console.log("performanceFee: %s", performanceFee);
  });

});