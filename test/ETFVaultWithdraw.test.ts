/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Contract } from "ethers";
import { formatUSDC, parseUSDC } from './helpers/helpers';
import type { ETFVaultMock } from '../typechain-types';
import { MockContract } from "ethereum-waffle";
import { setCurrentAllocations } from "./helpers/vaultHelpers";
import { beforeEachETFVault, Protocol } from "./helpers/vaultBeforeEach";

const amountUSDC = parseUSDC('100000'); // 100k

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: MockContract, 
  compoundProvider: MockContract, 
  aaveProvider: MockContract, 
  vaultMock: ETFVaultMock,
  userAddr: string,
  IUSDc: Contract,
  allProtocols: Protocol[];

  beforeEach(async function() {
    [
      vaultMock,
      ,
      userAddr,
      ,
      allProtocols,
      IUSDc,
      yearnProvider, 
      compoundProvider, 
      aaveProvider
    ] = await beforeEachETFVault(amountUSDC, true);
  });

  it("Deposit, withdraw and burn Xaver LP Tokens", async function() {
    console.log(`-------------Depositing 9k-------------`)
    
    const amountUSDC = parseUSDC('9000');
    const startingBalance = await IUSDc.balanceOf(userAddr);
    await setCurrentAllocations(vaultMock, allProtocols); 
    await vaultMock.depositETF(userAddr, amountUSDC);

    // LP balance should be 9k
    expect(await vaultMock.balanceOf(userAddr)).to.be.equal(amountUSDC);
    expect(await vaultMock.totalSupply()).to.be.equal(parseUSDC('9000'));

    console.log(`Mocking 0 balance in protocols => withdraw all funds (9k)`);
    const mockedBalance = parseUSDC('0');
    await Promise.all([
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalance),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance),
    ]);

    await vaultMock.withdrawETF(userAddr, amountUSDC); // withdraw 9k == everything

    expect(await vaultMock.totalSupply()).to.be.equal(0);
    expect(await vaultMock.balanceOf(userAddr)).to.be.equal(0);
    expect(await IUSDc.balanceOf(userAddr)).to.be.equal(startingBalance);

    console.log(`Mocking 15k balance in protocols, with 300 Profit (so 15.9k totalUnderlying in protocols) each and 5k in Vault =>`);
    const mocked2Balance = parseUSDC('5000');
    const profit = parseUSDC('300');
    await vaultMock.depositETF(userAddr, parseUSDC('20000'));

    expect(await IUSDc.balanceOf(userAddr)).to.be.equal(startingBalance.sub(parseUSDC('20000')));
    expect(Number(formatUSDC(await vaultMock.totalSupply()))).to.be.equal(20_000);
    expect(Number(formatUSDC(await vaultMock.balanceOf(userAddr)))).to.be.equal(20_000);
    expect(Number(formatUSDC(await IUSDc.balanceOf(vaultMock.address)))).to.be.equal(20_000);

    // bumping the exchangerate up to 1.045
    await Promise.all([
      vaultMock.clearCurrencyBalance(parseUSDC('15000')),
      yearnProvider.mock.balanceUnderlying.returns(mocked2Balance.add(profit)),
      compoundProvider.mock.balanceUnderlying.returns(mocked2Balance.add(profit)),
      aaveProvider.mock.balanceUnderlying.returns(mocked2Balance.add(profit)),
    ]);
 
    await vaultMock.withdrawETF(userAddr, parseUSDC('2000')); 

    expect(await vaultMock.totalSupply()).to.be.equal(parseUSDC('18000')); // TS == 20k - 2k
    expect(await vaultMock.balanceOf(userAddr)).to.be.equal(parseUSDC('18000')); // LP balance == 20k - 2k
    expect(await vaultMock.exchangeRate()).to.be.equal(parseUSDC('1.045')) // 900 profit == 900 / 20k = 4,5% 
    // withdraw 2000 LP = 2000 x 1.045 => 2090 usdc
    // EndBalance = StartingBalance - 20k + 2000 + 90 profit 
    expect(await IUSDc.balanceOf(userAddr)).to.be.equal(startingBalance.sub(parseUSDC('20000')).add(parseUSDC('2090')));
  });

});
