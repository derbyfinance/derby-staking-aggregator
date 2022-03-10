/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, routerAddProtocol } from './helpers/helpers';
import type { ETFVaultMock, Router } from '../typechain-types';
import { MockContract } from "ethereum-waffle";
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { deployAaveProviderMock, deployCompoundProviderMock, deployYearnProviderMock } from './helpers/deployMocks';
import { setCurrentAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, compToken as comp, aave, yearn, WEth, uniswapFactory, uniswapRouter} from "./helpers/addresses";

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const marginScale = 1E10;
const uScale = 1E6;
const liquidityPerc = 10;
const amountUSDC = parseUSDC('100000'); // 100k
let protocolYearn = { number: 0, allocation: 20, address: yusdc };
let protocolCompound = { number: 0, allocation: 40, address: cusdc };
let protocolAave = { number: 0, allocation: 60, address: ausdc };
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
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, userAddr, router.address, usdc, marginScale, uScale, liquidityPerc, uniswapRouter, uniswapFactory, WEth),
      deployYearnProviderMock(dao),
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    [protocolCompound.number, protocolAave.number, protocolYearn.number] = await Promise.all([
      routerAddProtocol(router, compoundProvider.address, cusdc, usdc, comp),
      routerAddProtocol(router, aaveProvider.address, ausdc, usdc, aave),
      routerAddProtocol(router, yearnProvider.address, yusdc, usdc, yearn),
      router.addVault(vaultMock.address),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(2)),
    ]);
  });

  it("Deposit, mint and return Xaver LP tokens", async function() {
    console.log(`-------------Depositing 9k-------------`)
    allProtocols = [protocolYearn, protocolCompound, protocolAave];
    const amountUSDC = parseUSDC('9000');
    await setCurrentAllocations(vaultMock, allProtocols); 
    await vaultMock.depositETF(userAddr, amountUSDC);

    const LPBalanceUser = await vaultMock.balanceOf(userAddr);
    expect(LPBalanceUser).to.be.equal(amountUSDC);

    console.log(`Mocking a rebalance with the 9k deposit => 3k to each protocol`);
    const mockedBalance = parseUSDC('3000'); // 3k in each protocol

    await Promise.all([
      vaultMock.clearCurrencyBalance(parseUSDC('9000')),
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalance),
      aaveProvider.mock.balanceUnderlying.returns(mockedBalance),
    ]);
    await vaultMock.depositETF(userAddr, parseUSDC('1000'));
    
    // expect LP Token balance User == 9k + 1k because Expect price == 1 i.e 1:1
    expect(await vaultMock.exchangeRate()).to.be.equal(parseUSDC('1'));
    expect(await vaultMock.balanceOf(userAddr)).to.be.equal(amountUSDC.add(parseUSDC('1000')));
    
    console.log(`Mocking a profit of 100 in each protocol with 1k sitting in vault`);
    const profit = parseUSDC('100');

    await Promise.all([
      yearnProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
      compoundProvider.mock.balanceUnderlying.returns(mockedBalance.add(profit)),
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

