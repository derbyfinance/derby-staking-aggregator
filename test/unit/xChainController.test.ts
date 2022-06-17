/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, formatUSDC, getUSDCSigner, parseEther, parseUSDC } from '../helpers/helpers';
import type { Controller, ETFGameMock, ETFVaultMock, XaverToken, XChainController } from '../../typechain-types';
import { deployController, deployETFGameMock, deployETFVaultMock, deployXaverToken, deployXChainController } from '../helpers/deploy';
import { usdc } from "../helpers/addresses";
import { initController, rebalanceETF } from "../helpers/vaultHelpers";
import allProviders  from "../helpers/allProvidersClass";
import { ethers } from "hardhat";
import { vaultInfo } from "../helpers/vaultHelpers";


const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, ETFnumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing XChainController, unit test", async () => {
  let vault1: ETFVaultMock, vault2: ETFVaultMock, vault3: ETFVaultMock, controller: Controller, xChainController: XChainController, game: ETFGameMock, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, xaverToken: XaverToken, userAddr: string;

  before(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    xChainController = await deployXChainController(dao);

    [vault1, vault2, vault3] = await Promise.all([
      await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
      await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
      await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
    ]);

    await Promise.all([
      initController(controller, [userAddr, vault1.address, vault2.address, vault3.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(vault1.address, amountUSDC),
      IUSDc.connect(user).approve(vault1.address, amountUSDC),
    ]);

    await Promise.all([
      vault1.setxChainControllerAddress(xChainController.address),
      vault2.setxChainControllerAddress(xChainController.address),
      vault3.setxChainControllerAddress(xChainController.address),
    ]);

  });

  it("Should 'cross chain' rebalance vaults and update vault state", async function() {
    const allocArrayForReference = [
      [1, 10],
      [1, 20],
      [2, 30],
      [2, 40],
      [3, 50],
      [3, 60],
    ];

    await Promise.all([
      xChainController.setETFVaultChainAddress(ETFnumber, 1, vault1.address, usdc),
      xChainController.setETFVaultChainAddress(ETFnumber, 2, vault2.address, usdc),
      xChainController.setETFVaultChainAddress(ETFnumber, 3, vault3.address, usdc),
    ]);

    await Promise.all([
      xChainController.setDeltaAllocationPerChain(ETFnumber, 1, 10 + 20),
      xChainController.setDeltaAllocationPerChain(ETFnumber, 2, 30 + 40),
      xChainController.setDeltaAllocationPerChain(ETFnumber, 3, 50 + 60),
      xChainController.setTotalDeltaAllocations(ETFnumber, 210),
    ]);

    // Set allocation amount and state in ETFVaults with ETFnumber 0
    await xChainController.rebalanceXChainAllocations(ETFnumber);
    
    const [state1, state2, state3] = await Promise.all([
      vault1.state(),
      vault2.state(),
      vault3.state(),
    ]);

    // Checking if vault states upped by atleast 1 after rebalanceXChainAllocations
    expect(state1).to.be.greaterThanOrEqual(1)
    expect(state2).to.be.greaterThanOrEqual(1)
    expect(state3).to.be.greaterThanOrEqual(1)
  });

  it("Should 'cross chain' rebalance vaults and deposit/withdraw through xChainController", async function() {
    await Promise.all([
      vault1.rebalanceXChain(),
      vault2.rebalanceXChain(),
      vault3.rebalanceXChain(),
    ]);

    await xChainController.executeDeposits(ETFnumber);

    const [balance1, balance2, balance3] = await Promise.all([
      await IUSDc.balanceOf(vault1.address), 
      await IUSDc.balanceOf(vault2.address), 
      await IUSDc.balanceOf(vault3.address), 
    ]);

    const expectedBalances = [
      30 / 210 * amount,
      70 / 210 * amount,
      110 / 210 * amount,
    ]

    console.log({balance1})
    console.log({balance2})
    console.log({balance3})

    expect(formatUSDC(balance1)).to.be.closeTo(expectedBalances[0], 1)
    expect(formatUSDC(balance2)).to.be.closeTo(expectedBalances[1], 1)
    expect(formatUSDC(balance3)).to.be.closeTo(expectedBalances[2], 1)
  });

  it("Should", async function() {
    console.log(xChainController.address)

    // await xChainController.rebalanceXChainAllocations2(ETFnumber);

    // for (const protocol of protocols.values()) {
    //   console.log(protocol.name)
    //   const deltaAllocation = await protocol.getDeltaAllocationTEST(vault);
    //   expect(deltaAllocation).to.be.greaterThan(0);
    //   expect(deltaAllocation).to.be.equal(protocol.allocation);
    // };

    // await Promise.all([
    //   compoundVault.setDeltaAllocation(vault1, user, 10),
    //   compoundDAIVault.setDeltaAllocation(vault1, user, 20),
    //   aaveVault.setDeltaAllocation(vault2, user, 30),
    //   aaveUSDTVault.setDeltaAllocation(vault2, user, 40),
    //   yearnVault.setDeltaAllocation(vault3, user, 50),
    //   yearnUSDTVault.setDeltaAllocation(vault3, user, 60),
    // ]);
  });

});