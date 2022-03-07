/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, routerAddProtocol, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, ERC20, Router } from '../typechain-types';
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { deployAllProviders, getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, aave, yearn, compToken as comp} from "./helpers/addresses";

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const liquidityPerc = 10;
const amountUSDC = parseUSDC('100000');
let protocolYearn = { number: 0, allocation: 0, address: yusdc };
let protocolCompound = { number: 0, allocation: 70, address: cusdc };
let protocolAave = { number: 0, allocation: 0, address: ausdc };
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, router: Router, dao: Signer, USDCSigner: Signer, IUSDc: Contract, IComp: Contract, daoAddr: string, user: Signer, userAddr: string, vaultMock: ETFVaultMock;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress(); // mock address for game
    router = await deployRouter(dao, daoAddr);

    // Deploy vault and all providers
    [vaultMock, [yearnProvider, compoundProvider, aaveProvider], USDCSigner, IUSDc, IComp] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, userAddr, router.address, usdc, liquidityPerc),
      deployAllProviders(dao, router),
      getUSDCSigner(),
      erc20(usdc),
      erc20(comp),
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    [protocolCompound.number, protocolAave.number, protocolYearn.number] = await Promise.all([
      routerAddProtocol(router, compoundProvider.address, cusdc, usdc, comp),
      routerAddProtocol(router, aaveProvider.address, ausdc, usdc, aave),
      routerAddProtocol(router, yearnProvider.address, yusdc, usdc, yearn),
      router.addVault(vaultMock.address),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      router.setClaimable(compoundProvider.address, true)
    ]);

    console.log(compoundProvider.address)
    console.log(router.address)
    console.log(vaultMock.address)
  });

  it("Should Swap tokens", async function() {
    const sqrtRatioX96 = 1461446703485210103287273052203988822378723970341
    const price = sqrtRatioX96 ** 2 / 2 ** 192;
    // const price = 2 ** 192 / sqrtRatioX96 ** 2
    console.log(price)
    // await setDeltaAllocations(user, vaultMock, allProtocols);
    // console.log('set delta')
    // await vaultMock.depositETF(userAddr, amountUSDC);
    // const tx = await vaultMock.rebalanceETF();

    // const ICusdc = await erc20(cusdc)
    // const balance = await ICusdc.balanceOf(vaultMock.address)
    // console.log(`balance cusdc vault: ${balance}`)

    // await vaultMock.claimTokens();
    await IUSDc.connect(user).transfer(vaultMock.address, amountUSDC)
    const usdcBalance = await IUSDc.balanceOf(vaultMock.address)
    console.log(`USDC Balance vault: ${usdcBalance}`)

    // const swapAmount = parseUSDC('10000');
    // await vaultMock.swapTokens(swapAmount, comp);

    const compBalance = await IComp.balanceOf(vaultMock.address)
    console.log(`Comp Balance vault: ${compBalance}`)

    await vaultMock.calcAmount(comp);
  });

});

