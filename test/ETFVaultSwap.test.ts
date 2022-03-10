/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, routerAddProtocol, getWhale, parseUnits, formatUnits, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, ERC20, Router, ETFVault } from '../typechain-types';
import { deployRouter, deployETFVault, deployETFVaultMock } from './helpers/deploy';
import { deployAllProviders, getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, aave, yearn, compToken as comp, uniswapFactory, uniswapRouter} from "./helpers/addresses";

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const uScale = 1E6;
const amountUSDC = parseUSDC('100000');
const CompWhale = '0x7587cAefc8096f5F40ACB83A09Df031a018C66ec'
const cusdcWhaleAddr = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
let protocolYearn = { number: 0, allocation: 0, address: yusdc };
let protocolCompound = { number: 0, allocation: 70, address: cusdc };
let protocolAave = { number: 0, allocation: 0, address: ausdc };
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, router: Router, dao: Signer, USDCSigner: Signer, IUSDc: Contract, IComp: Contract, IcUSDC: Contract, daoAddr: string, user: Signer, userAddr: string, vaultMock: ETFVaultMock, compSigner: Signer, cusdcWhale: Signer;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress(); // mock address for game
    router = await deployRouter(dao, daoAddr);
    compSigner = await getWhale(CompWhale);
    cusdcWhale = await getWhale(cusdcWhaleAddr);

    // Deploy vault and all providers
    [vaultMock, [yearnProvider, compoundProvider, aaveProvider], USDCSigner, IUSDc, IComp, IcUSDC] = await Promise.all([
      deployETFVault(dao, name, symbol, decimals, daoAddr, userAddr, router.address, usdc, uScale),
      deployAllProviders(dao, router),
      getUSDCSigner(),
      erc20(usdc),
      erc20(comp),
      erc20(cusdc)
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

  it("Claim function in vault should claim COMP and sell for USDC", async function() {
    const amountToDeposit = parseUSDC('100000')
    await setDeltaAllocations(user, vaultMock, allProtocols);

    // Deposit and rebalance with 100k in only Compound
    await vaultMock.depositETF(userAddr, amountToDeposit);
    await vaultMock.rebalanceETF();

    // mine 100 blocks to gain COMP Tokens
    for (let i = 0; i <= 100; i++) await network.provider.send("evm_mine");

    const USDCBalanceBeforeClaim = await IUSDc.balanceOf(vaultMock.address);
    await vaultMock.claimTokens()
    const USDCBalanceAfterClaim = await IUSDc.balanceOf(vaultMock.address);

    const USDCReceived = USDCBalanceAfterClaim.sub(USDCBalanceBeforeClaim)
    console.log(`USDC Received ${USDCReceived}`);

    expect(Number(USDCBalanceAfterClaim)).to.be.greaterThan(Number(USDCBalanceBeforeClaim))
  });

  it("Swapping COMP to USDC", async function() {
    const swapAmount = parseUnits('1000', 18); // 1000 comp tokens
    await IComp.connect(compSigner).transfer(vaultMock.address, swapAmount);

    const compBalance = await IComp.balanceOf(vaultMock.address);
    expect(Number(formatUnits(compBalance,18))).to.be.greaterThan(0);

    await vaultMock.swapTokensMulti(swapAmount, comp, usdc);
    const compBalanceEnd = await IComp.balanceOf(vaultMock.address);
    const usdcBalanceEnd = await IUSDc.balanceOf(vaultMock.address);

    expect(Number(formatUSDC(usdcBalanceEnd))).to.be.greaterThan(0);
    expect(compBalanceEnd).to.be.equal(0);
  });

  it("Swapping USDC to COMP and COMP back to USDC", async function() {
    const swapAmount = parseUSDC('10000');
    await IUSDc.connect(user).transfer(vaultMock.address, swapAmount);
    const usdcBalance = await IUSDc.balanceOf(vaultMock.address);
    console.log(`USDC Balance vault: ${usdcBalance}`)

    await vaultMock.swapTokensMulti(swapAmount, usdc, comp);

    const compBalance = await IComp.balanceOf(vaultMock.address);
    console.log(`Comp Balance vault: ${compBalance}`);

    // Atleast receive some COMP
    expect(Number(formatUnits(compBalance,18))).to.be.greaterThan(0);
    await vaultMock.swapTokensMulti(compBalance, comp, usdc);

    console.log(`USDC Balance vault End: ${await IUSDc.balanceOf(vaultMock.address)}`);
    const compBalanceEnd = await IComp.balanceOf(vaultMock.address);
    const usdcBalanceEnd = await IUSDc.balanceOf(vaultMock.address);

    // MultiHop swap fee is 0,6% => total fee = +- 1,2% => 10_000 * 1,2% = 120 fee
    expect(Number(formatUSDC(usdcBalanceEnd))).to.be.closeTo(10_000 - 120, 25);
    expect(compBalanceEnd).to.be.equal(0);
  });

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

  // it("SWap and calc COMP to USDC", async function() {
  //   const swapAmount = parseUnits('100', 18); // 100 comp tokens
  //   console.log(`USDC Balance vault Before: ${await IUSDc.balanceOf(vaultMock.address)}`)

  //   await IComp.connect(compSigner).transfer(vaultMock.address, swapAmount);
  //   console.log(`Comp Balance Vault: ${await IComp.balanceOf(vaultMock.address)}`)

  //   await vaultMock.swapTokensMulti(swapAmount, comp, usdc);

  //   console.log(`USDC Balance vault After: ${await IUSDc.balanceOf(vaultMock.address)}`)

  //   console.log('--------------------')
  //   const amountOutWeth = await vaultMock.getPoolAmountOut(swapAmount, comp, WEth);
  //   console.log(`100 COMP to WETH: ${amountOutWeth}`)
  //   console.log(amountOutWeth)

  //   console.log('--------------------')
  //   const amountOutComp = await vaultMock.getPoolAmountOut(amountOutWeth, WEth, usdc)
  //   console.log(`Weth to USDC: ${amountOutComp}`)
  //   console.log(amountOutComp)

  //   console.log('--------------------')
  //   const amountOutBack = await vaultMock.getPoolAmountOut(amountOutComp, usdc, WEth);
  //   console.log(`USDC to Weth: ${amountOutBack}`)
  //   console.log(amountOutBack)

  //   console.log('--------------------')
  //   const amountOutBacktoUSDC = await vaultMock.getPoolAmountOut(amountOutBack, WEth, comp)
  //   console.log(`Weth Back to COMP: ${amountOutBacktoUSDC}`)
  //   console.log(amountOutBacktoUSDC)

  // });

});

// price Token0 = sqrtRatioX96 ** 2 / 2 ** 192
// price Token1 = 2 ** 192 / sqrtRatioX96 ** 2