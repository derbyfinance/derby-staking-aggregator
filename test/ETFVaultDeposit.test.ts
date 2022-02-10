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
const symbol = 'xUSDC'
const amountUSDC = parseUSDC('90000'); // 90k
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
      deployETFVaultMock(dao, name, symbol, daoAddr, ETFNumber, router.address, usdc, threshold),
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

  it("Deposit, mint and return Xaver tokens", async function() {
    console.log(`-------------Depositing 90k-------------`)
    await setCurrentAllocations(vaultMock, allProtocols); 
    
    await vaultMock.depositETF(userAddr, amountUSDC);
    const LPBalanceUser = await vaultMock.balanceOf(userAddr);

    expect(LPBalanceUser).to.be.equal(amountUSDC);

    console.log(`Mocking a rebalance with the 90k deposit => 30k to each protocol`);
    const mockedBalance = parseUSDC('30000'); // 30k in each protocol

    await Promise.all([
      vaultMock.clearCurrencyBalance(),
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalance),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance),
    ])
    
    // Depositing 10k after rebalance
    await vaultMock.depositETF(userAddr, parseUSDC('10000'));
    console.log(Number(await vaultMock.exchangeRate()));

    console.log(`Mocking a profit of 1k in each protocol`);
    const profit = parseUSDC('1000');

    await Promise.all([
      vaultMock.clearCurrencyBalance(),
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
    ])
  });

});

