/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet, utils, Contract } from "ethers";
import { ethers, waffle } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, formatUnits } from './helpers/helpers';
import type { ETFVaultMock, ERC20, Router } from '../typechain-types';
import { MockContract } from "ethereum-waffle";
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { deployAaveProviderMock, deployCompoundProviderMock, deployYearnProviderMock } from './helpers/deployMocks';
import { setCurrentAllocations } from "./helpers/vaultHelpers";
import { usdc } from "./helpers/addresses";

const name = 'XaverUSDC';
const symbol = 'xUSDC';
const decimals = 6;
const amountUSDC = parseUSDC('100000'); // 100k
const threshold = parseUSDC('0');
const ETFNumber = 1;
let protocolYearn = [1, 1];
let protocolCompound = [2, 1];
let protocolAave = [3, 1];
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy Contracts and interact with Vault", async () => {
  let router: Router, dao: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, user: Signer, userAddr: string, vaultMock: ETFVaultMock, yearnProvider: MockContract, compoundProvider: MockContract, aaveProvider: MockContract ;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress();
    router = await deployRouter(dao, daoAddr);

    // Deploy vault and all providers
    [vaultMock, yearnProvider, compoundProvider, aaveProvider, USDCSigner, IUSDc] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, ETFNumber, router.address, usdc, threshold),
      deployYearnProviderMock(dao),
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(2)),
      router.addProtocol(ETFNumber, protocolYearn[0], yearnProvider.address, vaultMock.address),
      router.addProtocol(ETFNumber, protocolCompound[0], compoundProvider.address, vaultMock.address),
      router.addProtocol(ETFNumber, protocolAave[0], aaveProvider.address, vaultMock.address)
    ])
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

    console.log(`Mocking 15k balance in protocols, with 300 Profit each and 5k in Vault =>`);
    const mocked2Balance = parseUSDC('5000');
    const profit = parseUSDC('300')
    await vaultMock.depositETF(userAddr, parseUSDC('20000'));

    await Promise.all([
      vaultMock.clearCurrencyBalance(parseUSDC('15000')),
      yearnProvider.mock.balanceUnderlying.returns(mocked2Balance.add(profit)),
      compoundProvider.mock.balanceUnderlying.returns(mocked2Balance.add(profit)),
      aaveProvider.mock.balanceUnderlying.returns(mocked2Balance.add(profit)),
    ]);

    await vaultMock.withdrawETF(userAddr, parseUSDC('2000'));

    expect(await vaultMock.totalSupply()).to.be.equal(parseUSDC('18000')); // TS == 20k - 2k
    // expect(await vaultMock.balanceOf(userAddr)).to.be.equal(0);
    // expect(await IUSDc.balanceOf(userAddr)).to.be.equal(startingBalance);
  });

});

