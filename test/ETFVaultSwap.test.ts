/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { network } from "hardhat";
import { formatUSDC, parseUSDC, parseUnits, formatUnits, erc20, } from './helpers/helpers';
import type { ETFVaultMock } from '../typechain-types';
import { setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, dai, compToken as comp} from "./helpers/addresses";
import { beforeEachETFVault, Protocol } from "./helpers/vaultBeforeEach";

const amountUSDC = parseUSDC('100000');

describe("Deploy Contracts and interact with Vault", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolAave: Protocol,
  protocolYearn: Protocol,
  allProtocols: Protocol[],
  IComp: Contract,
  compSigner: Signer,
  IDAI: Contract;


  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn],
      allProtocols,
      IUSDc,,,,,,,
      IComp,
      compSigner
    ] = await beforeEachETFVault(amountUSDC)

    IDAI = await erc20(dai);
  });

  it("Claim function in vault should claim COMP and sell for USDC", async function() {
    protocolYearn.allocation = 0;
    protocolCompound.allocation = 70;
    protocolAave.allocation = 0;

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

    await vaultMock.swapTokensMultiTest(swapAmount, comp, usdc);
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

    await vaultMock.swapTokensMultiTest(swapAmount, usdc, comp);

    const compBalance = await IComp.balanceOf(vaultMock.address);
    console.log(`Comp Balance vault: ${compBalance}`);

    // Atleast receive some COMP
    expect(Number(formatUnits(compBalance,18))).to.be.greaterThan(0);
    await vaultMock.swapTokensMultiTest(compBalance, comp, usdc);

    console.log(`USDC Balance vault End: ${await IUSDc.balanceOf(vaultMock.address)}`);
    const compBalanceEnd = await IComp.balanceOf(vaultMock.address);
    const usdcBalanceEnd = await IUSDc.balanceOf(vaultMock.address);

    // MultiHop swap fee is 0,6% => total fee = +- 1,2% => 10_000 * 1,2% = 120 fee
    expect(Number(formatUSDC(usdcBalanceEnd))).to.be.closeTo(10_000 - 120, 25);
    expect(compBalanceEnd).to.be.equal(0);
  });

  it("Swapping USDC to COMP and COMP back to USDC", async function() {
    const swapAmount = parseUSDC('10000');
    await IUSDc.connect(user).transfer(vaultMock.address, swapAmount);
    const usdcBalance = await IUSDc.balanceOf(vaultMock.address);
    console.log(`USDC Balance vault: ${formatUSDC(usdcBalance)}`)

    await vaultMock.swapper(swapAmount, usdc, dai);

    const daiBalance = await IDAI.balanceOf(vaultMock.address);
    console.log(`Dai Balance vault: ${formatUnits(daiBalance, 18)}`);

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