/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, formatUSDC, getUSDCSigner, parseEther, parseUSDC } from '../helpers/helpers';
import type { Controller, ETFGameMock, ETFVaultMock, XaverToken, XChainController } from '../../typechain-types';
import { deployController, deployETFGameMock, deployETFVaultMock, deployXaverToken, deployXChainController } from '../helpers/deploy';
import { usdc, starterProtocols as protocols } from "../helpers/addresses";
import { initController, rebalanceETF } from "../helpers/vaultHelpers";
import allProviders  from "../helpers/allProvidersClass";
import { ethers } from "hardhat";
import { vaultInfo } from "../helpers/vaultHelpers";


const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const totalXaverSupply = parseEther(1E8.toString()); 
const { name, symbol, decimals, ETFname, ETFnumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing ETFVault, unit test", async () => {
  let vault: ETFVaultMock, controller: Controller, xChainController: XChainController, game: ETFGameMock, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, xaverToken: XaverToken, userAddr: string;

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

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
    xaverToken = await deployXaverToken(user, name, symbol, totalXaverSupply);
    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity);
    game = await deployETFGameMock(user, nftName, nftSymbol, xaverToken.address, controller.address, daoAddr, controller.address);

    await Promise.all([
      initController(controller, [userAddr, vault.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, ETFnumber, allProviders);
      await protocol.resetAllocation(vault);
    }
  });

  it("Should", async function() {
    console.log(xChainController.address);
  });

});