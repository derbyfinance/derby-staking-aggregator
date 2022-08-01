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
const chainIds = [10, 100, 1000];
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe.only("Testing XChainController, unit test", async () => {
  let vault1: VaultMock, vault2: VaultMock, vault3: VaultMock, controller: Controller, xChainController: XChainControllerMock, xProvider10: XProvider, xProvider100: XProvider, xProvider1000: XProvider, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, ConnextExecutor: ConnextExecutorMock, ConnextHandler: ConnextHandlerMock;

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

    [xProvider10, xProvider100, xProvider1000] = await Promise.all([
      deployXProvider(dao, ConnextExecutor.address, ConnextHandler.address, daoAddr, userAddr, xChainController.address, 10),
      deployXProvider(dao, ConnextExecutor.address, ConnextHandler.address, daoAddr, userAddr, xChainController.address, 100),
      deployXProvider(dao, ConnextExecutor.address, ConnextHandler.address, daoAddr, userAddr, xChainController.address, 1000)
    ]);

    [vault1, vault2, vault3] = await Promise.all([
      deployVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
      deployVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
      deployVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
    ]);

    await Promise.all([
      xProvider10.setXControllerProvider(xProvider100.address),
      xProvider10.setXControllerChainId(100),
      xProvider10.setGameChainId(10),
      xProvider10.whitelistSender(xChainController.address),
      xProvider100.setXControllerProvider(xProvider100.address),
      xProvider100.setXControllerChainId(100),
      xProvider100.setGameChainId(10),
      xProvider100.whitelistSender(xChainController.address),
      xProvider1000.setXControllerProvider(xProvider100.address),
      xProvider1000.setXControllerChainId(100),
      xProvider1000.setGameChainId(10),
      xProvider1000.whitelistSender(xChainController.address),
    ]);

    await Promise.all([
      initController(controller, [userAddr, vault1.address, vault2.address, vault3.address]),
      ConnextHandler.setExecutor(ConnextExecutor.address),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(5)),
      IUSDc.connect(user).approve(vault1.address, amountUSDC),
      IUSDc.connect(user).approve(vault2.address, amountUSDC.mul(2)),
    ]);

    await Promise.all([
      vault1.setxChainControllerAddress(xChainController.address),
      vault2.setxChainControllerAddress(xChainController.address),
      vault3.setxChainControllerAddress(xChainController.address),
    ]);

    await Promise.all([
      xChainController.setVaultChainAddress(vaultNumber, 10, vault1.address, usdc),
      xChainController.setVaultChainAddress(vaultNumber, 100, vault2.address, usdc),
      xChainController.setVaultChainAddress(vaultNumber, 1000, vault3.address, usdc),
      xChainController.setXProviderAddress(xProvider10.address, 10),
      xChainController.setXProviderAddress(xProvider100.address, 100), 
      xChainController.setXProviderAddress(xProvider1000.address, 1000), 
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

  it("3) Trigger xChainController to pull totalUnderlyings from all vaults", async function() {
    await vault1.connect(user).depositETF(amountUSDC); // 100k
    await vault2.connect(user).depositETF(amountUSDC.mul(2)); // 200k

    await xChainController.setAllocationsReceivedTEST(vaultNumber, true);

    await xChainController.setTotalUnderlying(vaultNumber);

    console.log("hii")

    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 10)).to.be.equal(amountUSDC); // 100k
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 100)).to.be.equal(amountUSDC.mul(2)); // 200k
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 1000)).to.be.equal(0); // 0

    const totalUnderlying = await xChainController.getTotalUnderlyingVaultTEST(vaultNumber);
    console.log({ totalUnderlying })

    expect(totalUnderlying).to.be.equal(amountUSDC.mul(3)); // 300k
  });

});