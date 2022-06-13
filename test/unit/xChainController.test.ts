/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, formatUSDC, getUSDCSigner, parseEther, parseUSDC } from '../helpers/helpers';
import type { Controller, ETFGameMock, ETFVaultMock, XaverToken, XChainController } from '../../typechain-types';
import { deployController, deployETFGameMock, deployETFVaultMock, deployXaverToken, deployXChainController } from '../helpers/deploy';
import { usdc, starterProtocols as protocols, compound_usdc_01, aave_usdc_01, yearn_usdc_01, compound_dai_01, aave_usdt_01, yearn_usdt_01 } from "../helpers/addresses";
import { initController, rebalanceETF } from "../helpers/vaultHelpers";
import allProviders  from "../helpers/allProvidersClass";
import { ethers } from "hardhat";
import { vaultInfo } from "../helpers/vaultHelpers";
import { ProtocolVault } from "@testhelp/protocolVaultClass";


const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const totalXaverSupply = parseEther(1E8.toString()); 
const { name, symbol, decimals, ETFname, ETFnumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing XChainController, unit test", async () => {
  let vault1: ETFVaultMock, vault2: ETFVaultMock, vault3: ETFVaultMock, controller: Controller, xChainController: XChainController, game: ETFGameMock, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, xaverToken: XaverToken, userAddr: string;

  const protocols = new Map<string, ProtocolVault>()
  .set('compound_usdc_01', compound_usdc_01)
  .set('compound_dai_01', compound_dai_01)
  .set('aave_usdc_01', aave_usdc_01)
  .set('aave_usdt_01', aave_usdt_01)
  .set('yearn_usdc_01', yearn_usdc_01)
  .set('yearn_usdt_01', yearn_usdt_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const compoundDAIVault = protocols.get('compound_dai_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const aaveUSDTVault = protocols.get('aave_usdt_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;
  const yearnUSDTVault = protocols.get('yearn_usdt_01')!;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    xChainController = await deployXChainController(dao);
    // xaverToken = await deployXaverToken(user, name, symbol, totalXaverSupply);
    // game = await deployETFGameMock(user, nftName, nftSymbol, xaverToken.address, controller.address, daoAddr, controller.address);

    [vault1, vault2, vault3] = await Promise.all([
      await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
      await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
      await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
    ]);

    await Promise.all([
      initController(controller, [userAddr, vault1.address, vault2.address, vault3.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault1.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, ETFnumber, allProviders);
    }
  });

  it("Should", async function() {
    console.log(xChainController.address);

    const allocArray = [
      [1, 10],
      [1, 20],
      [2, 30],
      [2, 40],
      [3, 50],
      [3, 60],
    ];

    await Promise.all([
      xChainController.setETFVaultChainAddress(ETFnumber, 1, vault1.address),
      xChainController.setETFVaultChainAddress(ETFnumber, 2, vault2.address),
      xChainController.setETFVaultChainAddress(ETFnumber, 3, vault3.address),
    ]);

    await Promise.all([
      xChainController.setDeltaAllocationPerChain(ETFnumber, 1, 10 + 20),
      xChainController.setDeltaAllocationPerChain(ETFnumber, 2, 30 + 40),
      xChainController.setDeltaAllocationPerChain(ETFnumber, 3, 50 + 60),
      xChainController.setTotalDeltaAllocations(ETFnumber, 210),
    ]);
    
    await Promise.all([
      compoundVault.setDeltaAllocation(vault1, user, 10),
      compoundDAIVault.setDeltaAllocation(vault1, user, 20),
      aaveVault.setDeltaAllocation(vault2, user, 30),
      aaveUSDTVault.setDeltaAllocation(vault2, user, 40),
      yearnVault.setDeltaAllocation(vault3, user, 50),
      yearnUSDTVault.setDeltaAllocation(vault3, user, 60),
    ]);

    const testers1 = await compoundDAIVault.getDeltaAllocationTEST(vault1);
    const testers2 = await aaveUSDTVault.getDeltaAllocationTEST(vault2);

    console.log({testers1})
    console.log({testers2})

    // for (const protocol of protocols.values()) {
    //   console.log(protocol.name)
    //   const deltaAllocation = await protocol.getDeltaAllocationTEST(vault);
    //   expect(deltaAllocation).to.be.greaterThan(0);
    //   expect(deltaAllocation).to.be.equal(protocol.allocation);
    // };
  });

});