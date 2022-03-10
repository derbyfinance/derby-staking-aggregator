/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { ethers, } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, routerAddProtocol } from './helpers/helpers';
import type { ETFVaultMock, Router } from '../typechain-types';
import { MockContract } from "ethereum-waffle";
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { deployAaveProviderMock, deployCompoundProviderMock, deployYearnProviderMock } from './helpers/deployMocks';
import { setCurrentAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, compToken as comp, yearn, aave, uniswapRouter, uniswapFactory, WEth} from "./helpers/addresses";

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

  it("Deposit, withdraw and burn Xaver LP Tokens", async function() {
    console.log(`-------------Depositing 9k-------------`)
    allProtocols = [protocolYearn, protocolCompound, protocolAave];
    
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
 
    const exchangeRate = await vaultMock.exchangeRate();
    await vaultMock.withdrawETF(userAddr, parseUSDC('2000')); 

    expect(await vaultMock.totalSupply()).to.be.equal(parseUSDC('18000')); // TS == 20k - 2k
    expect(await vaultMock.balanceOf(userAddr)).to.be.equal(parseUSDC('18000')); // LP balance == 20k - 2k
    expect(await vaultMock.exchangeRate()).to.be.equal(parseUSDC('1.045')) // 900 profit == 900 / 20k = 4,5% 
    // withdraw 2000 LP = 2000 x 1.045 => 2090 usdc
    // EndBalance = StartingBalance - 20k + 2000 + 90 profit 
    expect(await IUSDc.balanceOf(userAddr)).to.be.equal(startingBalance.sub(parseUSDC('20000')).add(parseUSDC('2090')));
  });

});

