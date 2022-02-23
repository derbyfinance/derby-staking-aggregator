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
import { addProtocolsToRouter, setCurrentAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc} from "./helpers/addresses";

const name = 'XaverUSDC';
const symbol = 'xUSDC';
const decimals = 6;
const amountUSDC = parseUSDC('100000'); // 100k
const threshold = parseUSDC('0');
const ETFNumber = 1;
let protocolYearn = { number: 1, allocation: 20, address: yusdc };
let protocolCompound = { number: 2, allocation: 40, address: cusdc };
let protocolAave = { number: 3, allocation: 60, address: ausdc };
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
      addProtocolsToRouter(ETFNumber, router, vaultMock.address, allProtocols, [yearnProvider, compoundProvider, aaveProvider])
    ]);
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
    const profit = parseUSDC('300');
    await vaultMock.depositETF(userAddr, parseUSDC('20000'));

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

