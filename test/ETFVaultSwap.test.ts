/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { network } from "hardhat";
import { formatUSDC, parseUSDC, parseUnits, formatUnits, erc20, routerAddProtocol, } from './helpers/helpers';
import type { ETFVaultMock } from '../typechain-types';
import { getAllocations, getAndLogBalances, rebalanceETF, setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, dai, compToken as comp, compoundDAI} from "./helpers/addresses";
import { beforeEachETFVault, Protocol } from "./helpers/vaultBeforeEach";
import { parseEther } from "ethers/lib/utils";

const amountUSDC = parseUSDC('100000');
const uScale = 1E6;

describe("Deploy Contracts and interact with Vault", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolCompoundDAI: Protocol,
  protocolAave: Protocol,
  protocolAaveUSDT: Protocol,
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
      [protocolCompound, protocolAave, protocolYearn, protocolCompoundDAI, protocolAaveUSDT],
      allProtocols,
      IUSDc,,,,,,,
      IComp,
      compSigner,,,,
      dao
    ] = await beforeEachETFVault(amountUSDC)

    IDAI = await erc20(dai);
  });

  it("Claim function in vault should claim COMP and sell for USDC", async function() {
    protocolYearn.allocation = 0;
    protocolCompound.allocation = 60;
    protocolAave.allocation = 0;

    const amountToDeposit = parseUSDC('100000');
    await setDeltaAllocations(user, vaultMock, allProtocols);

    // Deposit and rebalance with 100k in only Compound
    await vaultMock.depositETF(userAddr, amountToDeposit);
    await vaultMock.rebalanceETF();
    // mine 100 blocks to gain COMP Tokens
    for (let i = 0; i <= 100; i++) await network.provider.send("evm_mine");

    const USDCBalanceBeforeClaim = await IUSDc.balanceOf(vaultMock.address);
    await vaultMock.claimTokens()
    const USDCBalanceAfterClaim = await IUSDc.balanceOf(vaultMock.address);

    const USDCReceived = USDCBalanceAfterClaim.sub(USDCBalanceBeforeClaim);
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

  it("Curve Stable coin swap USDC to DAI", async function() {
    const swapAmount = parseUSDC('10000');
    await IUSDc.connect(user).transfer(vaultMock.address, swapAmount);

    // USDC Balance vault
    const usdcBalance = await IUSDc.balanceOf(vaultMock.address);
    console.log(`USDC Balance vault: ${formatUSDC(usdcBalance)}`);

    // Curve swap USDC to DAI
    await vaultMock.curveSwapTest(swapAmount, usdc, dai);

    // DAI Balance vault
    const daiBalance = await IDAI.balanceOf(vaultMock.address);
    console.log(`Dai Balance vault: ${formatUnits(daiBalance, 18)}`);

    // Expect DAI received to be 10_000 - fee
    expect(Number(formatUnits(daiBalance, 18))).to.be.closeTo(10_000, 5);
  });

  it("Should add CompoundDAI and AaveUSDT to vault and Swap on deposit/withdraw", async function() {
    protocolYearn.allocation = 0;
    protocolCompound.allocation = 20;
    protocolCompoundDAI.allocation = 40;
    protocolAave.allocation = 0;
    protocolAaveUSDT.allocation = 40;

    allProtocols = [...allProtocols, protocolCompoundDAI, protocolAaveUSDT];

    const amountToDeposit = parseUSDC('100000');
    await setDeltaAllocations(user, vaultMock, allProtocols);

    // Deposit and rebalance with 100k 
    await vaultMock.depositETF(userAddr, amountToDeposit);
    let gasUsed = await rebalanceETF(vaultMock);

    console.log(`USDC Balance vault: ${formatUSDC(await IUSDc.balanceOf(vaultMock.address))}`)

    const [balances, allocations, totalAllocatedTokens, balanceVault] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      getAllocations(vaultMock, allProtocols),
      vaultMock.totalAllocatedTokens(),
      IUSDc.balanceOf(vaultMock.address)
    ]);

    // Check if balanceInProtocol === 
    // currentAllocation / totalAllocated * ( amountDeposited - balanceVault - gasUsed)
    allProtocols.forEach((protocol, i) => {
      expect(balances[i].div(uScale))
      .to.be.closeTo((allocations[i].mul((amountUSDC.sub(balanceVault).sub(gasUsed)).div(totalAllocatedTokens))).div(uScale), 50)
    })

    console.log('----------- Rebalance AaveUSDT to 0, compoundDAI to 10 -----------')
    protocolCompoundDAI.allocation = -30;
    protocolAaveUSDT.allocation = -40;
    await setDeltaAllocations(user, vaultMock, allProtocols);
    
    gasUsed = gasUsed.add(await rebalanceETF(vaultMock));

    console.log(`USDC Balance vault: ${formatUSDC(await IUSDc.balanceOf(vaultMock.address))}`)

    const [balances2, allocations2, totalAllocatedTokens2, balanceVault2] = await Promise.all([
      getAndLogBalances(vaultMock, allProtocols),
      getAllocations(vaultMock, allProtocols),
      vaultMock.totalAllocatedTokens(),
      IUSDc.balanceOf(vaultMock.address)
    ]);

    // Check if balanceInProtocol === 
    // currentAllocation / totalAllocated * ( amountDeposited - balanceVault - gasUsed)
    allProtocols.forEach((protocol, i) => {
      expect(balances2[i].div(uScale))
      .to.be.closeTo((allocations2[i].mul((amountUSDC.sub(balanceVault2).sub(gasUsed)).div(totalAllocatedTokens2))).div(uScale), 50) // swap fees
    })
  });

  it("Swapping USDC to Ether, unwrap and send to DAO to cover gas costs", async function() {
    const amountToDeposit = parseUSDC('100000')
    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.depositETF(userAddr, amountToDeposit);

    const ETHBalanceBefore = await dao.getBalance();
    await vaultMock.connect(dao).rebalanceETF();
    const ETHBalanceReceived = (await dao.getBalance()).sub(ETHBalanceBefore);
    console.log({ETHBalanceReceived});

    // gas costs in hardhat are hard to compare, so we expect to receive atleast some Ether back after the rebalance function
    expect(Number(ETHBalanceReceived)).to.be.greaterThan(Number(parseEther('0.03')));
  });

  it("Should always have some liquidity to pay for Rebalance fee", async function() {
    const gasFeeLiquidity = 10_000;
    const amountToDeposit = parseUSDC('100000');
    let amountToWithdraw = parseUSDC('50000');

    await setDeltaAllocations(user, vaultMock, allProtocols);

    // Deposit and rebalance with 100k 
    await vaultMock.depositETF(userAddr, amountToDeposit);
    let gasUsed = formatUSDC(await rebalanceETF(vaultMock));

    let balanceVault = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    let USDCBalanceUser = await IUSDc.balanceOf(userAddr)
    console.log({gasUsed})
    console.log(USDCBalanceUser)

    expect(Number(balanceVault)).to.be.greaterThanOrEqual(gasFeeLiquidity - Number(gasUsed))

    console.log("-----------------withdraw 50k-----------------")
    protocolCompound.allocation = -40;
    protocolAave.allocation = -60;
    protocolYearn.allocation = 120;

    await setDeltaAllocations(user, vaultMock, allProtocols);
    await vaultMock.withdrawETF(userAddr, amountToWithdraw);
    gasUsed = formatUSDC(await rebalanceETF(vaultMock));

    balanceVault = formatUSDC(await IUSDc.balanceOf(vaultMock.address));
    USDCBalanceUser = await IUSDc.balanceOf(userAddr)
    console.log({gasUsed})
    console.log(USDCBalanceUser)

    expect(Number(balanceVault)).to.be.greaterThanOrEqual(gasFeeLiquidity - Number(gasUsed))

    console.log("-----------------withdraw another 42k = 92k total-----------------")
    amountToWithdraw = parseUSDC('42000');
    await vaultMock.withdrawETF(userAddr, amountToWithdraw);
    await rebalanceETF(vaultMock);

    balanceVault = formatUSDC(await IUSDc.balanceOf(vaultMock.address));

    USDCBalanceUser = await IUSDc.balanceOf(userAddr)
    console.log({gasUsed})
    console.log(USDCBalanceUser)

    expect(Number(balanceVault)).to.be.greaterThanOrEqual(100_000 - 92_000 - Number(gasUsed))
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
// 