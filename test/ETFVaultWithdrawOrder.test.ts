/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet, utils, Contract } from "ethers";
import { ethers, waffle, network } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, ERC20, Router } from '../typechain-types';
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { addProtocolsToRouter, deployAllProviders, setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc} from "./helpers/addresses";

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
let protocolYearn = { number: 1, allocation: 20, address: yusdc };
let protocolCompound = { number: 2, allocation: 40, address: cusdc };
let protocolAave = { number: 5, allocation: 60, address: ausdc };
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy Contracts and interact with Vault Order", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, router: Router, dao: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, user: Signer, userAddr: string, vaultMock: ETFVaultMock;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress();
    router = await deployRouter(dao, daoAddr);

    // Deploy vault and all providers
    [vaultMock, USDCSigner, IUSDc, [yearnProvider, compoundProvider, aaveProvider]] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, userAddr, ETFNumber, router.address, usdc),
      getUSDCSigner(),
      erc20(usdc),
      deployAllProviders(dao, router, allProtocols)
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC),
      addProtocolsToRouter(ETFNumber, router, vaultMock.address, allProtocols, [yearnProvider, compoundProvider, aaveProvider])
    ]);
  });

  it("Should deposit and withdraw in order from protocols", async function() {
    await setDeltaAllocations(user, vaultMock, allProtocols);

    console.log('---------Deposit and rebalance with 100k----------');
    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();

    // LP Balance User == 100k
    expect(Number(formatUSDC(await vaultMock.balanceOf(userAddr)))).to.be.closeTo(100_000, 1);
    // TotalUnderlying == 100k
    let totalUnderlying = (await vaultMock.getTotalUnderlying()).add(await IUSDc.balanceOf(vaultMock.address));
    expect(Number(formatUSDC(totalUnderlying))).to.be.closeTo(100_000, 1);
    // Total liquid funds in vault == 10k
    let totalLiquidFunds = await IUSDc.balanceOf(vaultMock.address);
    expect(Number(formatUSDC(totalLiquidFunds))).to.be.closeTo(10_000, 1);
    // Total supply LP tokens == 100k
    expect(Number(formatUSDC(await vaultMock.totalSupply()))).to.be.equal(100_000);
    // Total Yearn
    let totalYearn = await yearnProvider.balanceUnderlying(vaultMock.address);
    expect(Number(formatUSDC(totalYearn))).to.be.closeTo(15_000, 1);
    // Total Compound
    let totalCompound = await compoundProvider.balanceUnderlying(vaultMock.address);
    expect(Number(formatUSDC(totalCompound))).to.be.closeTo(30_000, 1);   
    // Total Aave
    let totalAave = await aaveProvider.balanceUnderlying(vaultMock.address);
    expect(Number(formatUSDC(totalAave))).to.be.closeTo(45_000, 1);

    console.log('---------Withdraw 20k----------');
    await vaultMock.withdrawETF(userAddr, parseUSDC('20000'));

    // LP Balance user == 100k - 20k = 80k
    expect(Number(formatUSDC(await vaultMock.balanceOf(userAddr)))).to.be.closeTo(80_000, 1);
    // TotalUnderlying == 100k -20k = 80k
    totalUnderlying = await vaultMock.getTotalUnderlying();
    expect(Number(formatUSDC(totalUnderlying))).to.be.closeTo(80_000, 1);
    // Total liquid funds in vault == 0k
    totalLiquidFunds = await IUSDc.balanceOf(vaultMock.address);
    expect(Number(formatUSDC(totalLiquidFunds))).to.be.closeTo(0, 1); 
    // Total supply LP tokens == 80k
    expect(Number(formatUSDC(await vaultMock.totalSupply()))).to.be.equal(80_000);
    // Total Yearn
    totalYearn = await yearnProvider.balanceUnderlying(vaultMock.address);
    expect(Number(formatUSDC(totalYearn))).to.be.closeTo(5_000, 1);
    // Total Compound
    totalCompound = await compoundProvider.balanceUnderlying(vaultMock.address);
    expect(Number(formatUSDC(totalCompound))).to.be.closeTo(30_000, 1);   
    // Total Aave
    totalAave = await aaveProvider.balanceUnderlying(vaultMock.address);
    expect(Number(formatUSDC(totalAave))).to.be.closeTo(45_000, 1);

    console.log('---------Withdraw 60k----------');
    await vaultMock.withdrawETF(userAddr, parseUSDC('60000'));

    // LP Balance user == 100k - 20k - 60k = 20k
    expect(Number(formatUSDC(await vaultMock.balanceOf(userAddr)))).to.be.closeTo(20_000, 1);
    // TotalUnderlying == 100k -20k -60k = 20k
    totalUnderlying = await vaultMock.getTotalUnderlying();
    expect(Number(formatUSDC(totalUnderlying))).to.be.closeTo(20_000, 1);
    // Total liquid funds in vault == 0k
    totalLiquidFunds = await IUSDc.balanceOf(vaultMock.address);
    expect(Number(formatUSDC(totalLiquidFunds))).to.be.closeTo(0, 1); 
    // Total supply LP tokens == 20k
    expect(Number(formatUSDC(await vaultMock.totalSupply()))).to.be.equal(20_000);
    // Total Yearn
    totalYearn = await yearnProvider.balanceUnderlying(vaultMock.address);
    expect(Number(formatUSDC(totalYearn))).to.be.closeTo(0, 1);
    // Total Compound
    totalCompound = await compoundProvider.balanceUnderlying(vaultMock.address);
    expect(Number(formatUSDC(totalCompound))).to.be.closeTo(0, 1);   
    // Total Aave
    totalAave = await aaveProvider.balanceUnderlying(vaultMock.address);
    expect(Number(formatUSDC(totalAave))).to.be.closeTo(20_000, 1);

    console.log('---------Withdraw 30k = more then balance----------');
    // Should be reverted
    await expect(vaultMock.withdrawETF(userAddr, parseUSDC('60000'))).to.be.reverted;
  });
  

});

