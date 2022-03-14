/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC } from './helpers/helpers';
import type { ETFVaultMock } from '../typechain-types';
import { getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
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
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolAave: Protocol,
  protocolYearn: Protocol,
  allProtocols: Protocol[];

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn],
      allProtocols,
      IUSDc,
    ] = await beforeEachETFVault(amountUSDC)
  });

  it("Should have a name and symbol", async function() {
    expect(await vaultMock.name()).to.be.equal(name);
    expect(await vaultMock.symbol()).to.be.equal(symbol);
    expect(await vaultMock.decimals()).to.be.equal(decimals);
  });

  it("Should set delta allocations", async function() {
    await setDeltaAllocations(user, vaultMock, allProtocols);

    const [yearn, compound, aave] = await Promise.all([
      vaultMock.getDeltaAllocationTEST(protocolYearn.number),
      vaultMock.getDeltaAllocationTEST(protocolCompound.number),
      vaultMock.getDeltaAllocationTEST(protocolAave.number)
    ]);

    expect(yearn).to.be.equal(protocolYearn.allocation);
    expect(compound).to.be.equal(protocolCompound.allocation);
    expect(aave).to.be.equal(protocolAave.allocation);
  });

  it("Should deposit and rebalance", async function() {
    console.log('--------------depositing and rebalance with 100k ----------------')
    await setDeltaAllocations(user, vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();

    let LPBalanceUser = await vaultMock.balanceOf(userAddr);
    expect(LPBalanceUser).to.be.equal(amountUSDC);

    const [balances, allocations, totalAllocatedTokens, balanceVault] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      getAllocations(vaultMock, allProtocols),
      vaultMock.totalAllocatedTokens(),
      IUSDc.balanceOf(vaultMock.address)
    ]);

    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances[i].div(1E6))
      .to.be.closeTo(allocations[i].mul(amountUSDC.sub(balanceVault)).div(totalAllocatedTokens).div(uScale), 5)
    })
    // liquidity vault should be 100k * 10% = 10k
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(100_000 * liquidityPerc / 100, 1)

    console.log('--------------rebalancing with amount 0, withdraw 4k----------------')
    protocolYearn.allocation = 40;
    protocolCompound.allocation = -20;
    protocolAave.allocation = -20;

    const amountToWithdraw = parseUSDC('12000');

    await vaultMock.withdrawETF(userAddr, amountToWithdraw);
    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.rebalanceETF();

    LPBalanceUser = await vaultMock.balanceOf(userAddr);
    expect(LPBalanceUser).to.be.equal(amountUSDC.sub(amountToWithdraw));

    const [balances2, allocations2, totalAllocatedTokens2, balanceVault2] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      getAllocations(vaultMock, allProtocols),
      vaultMock.totalAllocatedTokens(),
      IUSDc.balanceOf(vaultMock.address)
    ]);

    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances2[i].div(1E6))
      .to.be.closeTo(allocations2[i].mul(amountUSDC.sub(balanceVault2).sub(amountToWithdraw)).div(totalAllocatedTokens2).div(uScale), 5)
    })
    // liquidity vault should be 100k - 12k * 10% = 8.8k
    expect(Number(formatUSDC(balanceVault2))).to.be.closeTo((100_000 - 12_000)  * liquidityPerc / 100, 1)

    console.log('--------------rebalancing with amount 50k and Yearn to 0 ----------------')
    protocolYearn.allocation = -60;
    protocolCompound.allocation = 80;
    protocolAave.allocation = 40;

    const amountToDeposit = parseUSDC('50000');
    const totalAmountDeposited = amountUSDC.add(amountToDeposit);

    await setDeltaAllocations(user, vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountToDeposit);
    await vaultMock.rebalanceETF();

    LPBalanceUser = await vaultMock.balanceOf(userAddr);
    console.log(`LP balance user: ${LPBalanceUser}`)
    expect(LPBalanceUser.div(1E6)).to.be.closeTo(amountUSDC.sub(amountToWithdraw).add(amountToDeposit).div(uScale), 5);

    const [balances3, allocations3, totalAllocatedTokens3, balanceVault3] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      getAllocations(vaultMock, allProtocols),
      vaultMock.totalAllocatedTokens(),
      IUSDc.balanceOf(vaultMock.address)
    ]);

    // Check if balanceInProtocol === currentAllocation / totalAllocated * totalAmountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances3[i].div(1E6))
      .to.be.closeTo(allocations3[i].mul((totalAmountDeposited.sub(balanceVault3).sub(amountToWithdraw))).div(totalAllocatedTokens3).div(uScale), 5)
    })
    // liquidity vault should be 100k - 12k + 50k * 10% = 13.8k
    expect(Number(formatUSDC(balanceVault3))).to.be.closeTo((100_000 - 12_000 + 50_000) * liquidityPerc / 100, 1)
  });

});
