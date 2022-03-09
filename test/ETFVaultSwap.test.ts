/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, routerAddProtocol, getWhale, parseUnits, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, ERC20, Router, ETFVault } from '../typechain-types';
import { deployRouter, deployETFVault, deployETFVaultMock } from './helpers/deploy';
import { deployAllProviders, getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, aave, yearn, compToken as comp, uniswapFactory, uniswapRouter, WEth} from "./helpers/addresses";

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const liquidityPerc = 10;
const amountUSDC = parseUSDC('100000');
const CompWhale = '0x7587cAefc8096f5F40ACB83A09Df031a018C66ec'
let protocolYearn = { number: 0, allocation: 0, address: yusdc };
let protocolCompound = { number: 0, allocation: 70, address: cusdc };
let protocolAave = { number: 0, allocation: 0, address: ausdc };
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, router: Router, dao: Signer, USDCSigner: Signer, IUSDc: Contract, IComp: Contract, daoAddr: string, user: Signer, userAddr: string, vaultMock: ETFVaultMock, compSigner: Signer;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress(); // mock address for game
    router = await deployRouter(dao, daoAddr);
    compSigner = await getWhale(CompWhale);

    // Deploy vault and all providers
    [vaultMock, [yearnProvider, compoundProvider, aaveProvider], USDCSigner, IUSDc, IComp] = await Promise.all([
      deployETFVault(dao, name, symbol, decimals, daoAddr, userAddr, router.address, usdc, liquidityPerc, uniswapRouter, uniswapFactory, WEth),
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
      router.addVault(userAddr),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      router.setClaimable(compoundProvider.address, true)
    ]);
  });

  // it("Sending USDC and Swapping for COMP", async function() {
  //   await IUSDc.connect(user).transfer(vaultMock.address, amountUSDC)
  //   const usdcBalance = await IUSDc.balanceOf(vaultMock.address)
  //   console.log(`USDC Balance vault: ${usdcBalance}`)

  //   const swapAmount = parseUSDC('10000');
  //   await vaultMock.swapTokensMulti(swapAmount, usdc, comp);

  //   const compBalance = await IComp.balanceOf(vaultMock.address)
  //   console.log(`Comp Balance vault: ${compBalance}`)

  //   await vaultMock.swapTokensMulti(compBalance, comp, usdc);

  //   console.log(`Comp Balance vault End: ${await IComp.balanceOf(vaultMock.address)}`)
  //   console.log(`USDC Balance vault End: ${await IUSDc.balanceOf(vaultMock.address)}`)
  // });

  // it("Calc USDC to COMP", async function() {
  //   const swapAmount = parseUSDC('10000');

  //   console.log('--------------------')
  //   const amountOutWeth = await vaultMock.getPoolAmountOut(swapAmount, usdc, WEth);
  //   console.log(`10k USDC to WETH: ${amountOutWeth}`)

  //   console.log('--------------------')
  //   const amountOutComp = await vaultMock.getPoolAmountOut(amountOutWeth, WEth, comp)
  //   console.log(`Weth to Comp: ${amountOutComp}`)

  //   console.log('--------------------')
  //   const amountOutBack = await vaultMock.getPoolAmountOut(amountOutComp, comp, WEth);
  //   console.log(`Comp to Weth: ${amountOutBack}`)

  //   console.log('--------------------')
  //   const amountOutBacktoUSDC = await vaultMock.getPoolAmountOut(amountOutBack, WEth, usdc)
  //   console.log(`Weth Back to USDC: ${amountOutBacktoUSDC}`)
  // });

  it("SWap and calc COMP to USDC", async function() {
    const swapAmount = parseUnits('100', 18); // 100 comp tokens
    console.log(`USDC Balance vault Before: ${await IUSDc.balanceOf(vaultMock.address)}`)

    await IComp.connect(compSigner).transfer(vaultMock.address, swapAmount);
    console.log(`Comp Balance Vault: ${await IComp.balanceOf(vaultMock.address)}`)

    await vaultMock.swapTokensMulti(swapAmount, comp, usdc);

    console.log(`USDC Balance vault After: ${await IUSDc.balanceOf(vaultMock.address)}`)

    console.log('--------------------')
    const amountOutWeth = await vaultMock.getPoolAmountOut(swapAmount, comp, WEth);
    console.log(`100 COMP to WETH: ${amountOutWeth}`)

    console.log('--------------------')
    const amountOutComp = await vaultMock.getPoolAmountOut(amountOutWeth, WEth, usdc)
    console.log(`Weth to USDC: ${amountOutComp}`)

    console.log('--------------------')
    const amountOutBack = await vaultMock.getPoolAmountOut(amountOutComp, usdc, WEth);
    console.log(`USDC to Weth: ${amountOutBack}`)

    console.log('--------------------')
    const amountOutBacktoUSDC = await vaultMock.getPoolAmountOut(amountOutBack, WEth, comp)
    console.log(`Weth Back to COMP: ${amountOutBacktoUSDC}`)

  });

});

// price Token0 = sqrtRatioX96 ** 2 / 2 ** 192
// price Token1 = 2 ** 192 / sqrtRatioX96 ** 2

88634752105670065756  // COMP Received from 10k USDC
100000000000 // USDC 10k
99880896578 // USDC Received back from COMP


100000000000000000000 // 100 comp

10112223804 // USDC Received for 100 COMP
9280303328