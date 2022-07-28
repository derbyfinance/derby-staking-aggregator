/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, formatUSDC, getUSDCSigner, parseEther, parseUSDC } from '../helpers/helpers';
import type { ConnextExecutorMock, ConnextHandlerMock, Controller, VaultMock, XChainControllerMock, XProvider } from '../../typechain-types';
import { deployConnextExecutorMock, deployConnextHandlerMock, deployController, deployVaultMock, deployXChainControllerMock, deployXProvider } from '../helpers/deploy';
import { usdc } from "../helpers/addresses";
import { initController } from "../helpers/vaultHelpers";
import allProviders  from "../helpers/allProvidersClass";
import { ethers } from "hardhat";
import { vaultInfo } from "../helpers/vaultHelpers";


const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing XChainController, unit test", async () => {
  let vault1: VaultMock, vault2: VaultMock, vault3: VaultMock, controller: Controller, xChainController: XChainControllerMock, xProvider10: XProvider, xProvider100: XProvider, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, ConnextExecutor: ConnextExecutorMock, ConnextHandler: ConnextHandlerMock;

  before(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    ConnextHandler = await deployConnextHandlerMock(dao, daoAddr);
    ConnextExecutor = await deployConnextExecutorMock(dao, ConnextHandler.address);

    controller = await deployController(dao, daoAddr);
    xChainController = await deployXChainControllerMock(dao, daoAddr, daoAddr, 100);

    [xProvider10, xProvider100] = await Promise.all([
      deployXProvider(dao, ConnextExecutor.address, ConnextHandler.address, daoAddr, xChainController.address, 10),
      deployXProvider(dao, ConnextExecutor.address, ConnextHandler.address, daoAddr, xChainController.address, 100)
    ]);

    [vault1, vault2, vault3] = await Promise.all([
      await deployVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
      await deployVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
      await deployVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
    ]);

    await Promise.all([
      xProvider10.setXControllerProvider(xProvider100.address),
      xProvider10.setXControllerChainId(100),
      xProvider100.setXControllerProvider(xProvider100.address),
      xProvider100.setXControllerChainId(100),
      xProvider10.setXControllerProvider(xProvider100.address),
      xProvider100.setXControllerProvider(xProvider100.address),
      xProvider10.setGameChainId(10),
      xProvider100.setGameChainId(10),
      xProvider10.whitelistSender(xChainController.address),
    ]);

    await Promise.all([
      initController(controller, [userAddr, vault1.address, vault2.address, vault3.address]),
      ConnextHandler.setExecutor(ConnextExecutor.address),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(5)),
      IUSDc.connect(user).approve(vault1.address, amountUSDC),
      IUSDc.connect(user).approve(vault2.address, amountUSDC),
    ]);

    await Promise.all([
      vault1.setxChainControllerAddress(xChainController.address),
      vault2.setxChainControllerAddress(xChainController.address),
      vault3.setxChainControllerAddress(xChainController.address),
    ]);

    await Promise.all([
      xChainController.setVaultChainAddress(vaultNumber, 1, vault1.address, usdc),
      xChainController.setVaultChainAddress(vaultNumber, 2, vault2.address, usdc),
      xChainController.setVaultChainAddress(vaultNumber, 3, vault3.address, usdc),
      xChainController.setXProviderAddress(xProvider10.address, 10),
      xChainController.setXProviderAddress(xProvider100.address, 100), 
      xChainController.setHomeXProviderAddress(xProvider100.address), // xChainController on chain 100
    ]);
  });

  it("1.5) Store vault stages", async function() {
    await xChainController.setActiveVaultsTEST(vaultNumber, 1);

    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(false);

    await xChainController.setReadyTEST(vaultNumber, true);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);

    await xChainController.setAllocationsReceivedTEST(vaultNumber, true);
    expect(await xChainController.getAllocationState(vaultNumber)).to.be.equal(true);

    await xChainController.upUnderlyingReceivedTEST(vaultNumber);
    expect(await xChainController.getUnderlyingState(vaultNumber)).to.be.equal(1);

    await xChainController.upFundsReceivedTEST(vaultNumber);
    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(1);

    await xChainController.resetVaultStagesTEST(vaultNumber);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);
    expect(await xChainController.getAllocationState(vaultNumber)).to.be.equal(false);
    expect(await xChainController.getUnderlyingState(vaultNumber)).to.be.equal(0);
    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(0);

  });

  it.only("3) Trigger xChainController to pull totalUnderlyings from all vaults", async function() {
    await vault1.connect(user).depositETF(amountUSDC); // 100k
    await vault2.connect(user).depositETF(amountUSDC); // 100k

    await xChainController.setTotalUnderlying(vaultNumber);

    const totalUnderlying = await xChainController.setTotalUnderlying(vaultNumber);
    console.log({ totalUnderlying })

    // expect(await xChainController.getTotalUnderlyingOnChain(vaultNumber, 10)).to.be.equal(amountUSDC);
    // expect(await xChainController.getTotalUnderlyingOnChain(vaultNumber, 100)).to.be.equal(amountUSDC);
    // expect(await xChainController.getTotalUnderlyingOnChain(vaultNumber, 1000)).to.be.equal(0);
    // expect(totalUnderlying).to.be.equal(amountUSDC.mul(2)); // 200k
  });

  // 
  it.skip("Should 'cross chain' rebalance vaults and update vault state", async function() {
    // const allocationArray = [ // For reference only at the moment
    //   [1, 10],
    //   [1, 20],
    //   [2, 30],
    //   [2, 40],
    //   [3, 50],
    //   [3, 60],
    // ];

    // await Promise.all([
    //   xChainController.setDeltaAllocationPerChain(vaultNumber, 1, 10 + 20),
    //   xChainController.setDeltaAllocationPerChain(vaultNumber, 2, 30 + 40),
    //   xChainController.setDeltaAllocationPerChain(vaultNumber, 3, 50 + 60),
    //   xChainController.setTotalDeltaAllocations(vaultNumber, 210),
    // ]);

    // // Set allocation amount and state in Vaults with vaultNumber 0
    // await xChainController.rebalanceXChainAllocations(vaultNumber);

    // // Checking if vault states upped by atleast 1 after rebalanceXChainAllocations
    // expect(await vault1.state()).to.be.greaterThanOrEqual(1);
    // expect(await vault2.state()).to.be.greaterThanOrEqual(1);
    // expect(await vault3.state()).to.be.greaterThanOrEqual(1);
  });

  it.skip("Should 'cross chain' rebalance vaults and deposit/withdraw through xChainController", async function() {
    // await Promise.all([
    //   vault1.rebalanceXChain(),
    //   vault2.rebalanceXChain(),
    //   vault3.rebalanceXChain(),
    // ]);

    // await xChainController.executeDeposits(vaultNumber);

    // const [balance1, balance2, balance3] = await Promise.all([
    //   await IUSDc.balanceOf(vault1.address), 
    //   await IUSDc.balanceOf(vault2.address), 
    //   await IUSDc.balanceOf(vault3.address), 
    // ]);

    // const expectedBalances = [
    //   30 / 210 * amount,
    //   70 / 210 * amount,
    //   110 / 210 * amount,
    // ];

    // console.log({balance1})
    // console.log({balance2})
    // console.log({balance3})

    // expect(formatUSDC(balance1)).to.be.closeTo(expectedBalances[0], 1);
    // expect(formatUSDC(balance2)).to.be.closeTo(expectedBalances[1], 1);
    // expect(formatUSDC(balance3)).to.be.closeTo(expectedBalances[2], 1);

    // // Checking if vault states upped to 3 => ready to rebalance vault itself
    // expect(await vault1.state()).to.be.equal(3);
    // expect(await vault2.state()).to.be.equal(3);
    // expect(await vault3.state()).to.be.equal(3);
  });
});