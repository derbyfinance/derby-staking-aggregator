/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, controllerAddProtocol, getDAISigner, getUSDTSigner, parseDAI, formatDAI, formatEther, } from '../helpers/helpers';
import type { AaveProvider, BetaProvider, CompoundProvider, Controller, ETFVaultMock, HomoraProvider, IdleProvider, YearnProvider } from '../../typechain-types';
import { deployAaveProvider, deployBetaProvider, deployCompoundProvider, deployController, deployETFVaultMock, deployHomoraProvider, deployIdleProvider, deployYearnProvider } from '../helpers/deploy';
import { allProtocols, usdc, betaUSDC as busdc, dai, usdt, comptroller} from "../helpers/addresses";
import { rebalanceETF } from "../helpers/vaultHelpers";

const amount = 10_000_000;
// const amount = Math.floor(Math.random() * 1000000);
const amountUSDC = parseUSDC(amount.toString());
const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const ETFname = 'USDC_med_risk';
const ETFnumber = 0;
const decimals = 6;
const uScale = 1E6;
const gasFeeLiquidity = 10_000 * uScale;

const getRandomAllocation = () => Math.floor(Math.random() * 10_000);

describe("Testing balanceUnderlying for every single protocol vault", async () => {
  let vault: ETFVaultMock, yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, homoraProvider: HomoraProvider, betaProvider: BetaProvider, idleProvider: IdleProvider, controller: Controller, dao: Signer, game: Signer, USDCSigner: Signer, DAISigner: Signer, USDTSigner: Signer, IUSDc: Contract, IDai: Contract, IUSDt: Contract, bToken: Contract, daoAddr: string, gameAddr: string, protocols: any;

  beforeEach(async function() {
    [dao, game] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    gameAddr = await game.getAddress();
    controller = await deployController(dao, daoAddr);

    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, gameAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    [yearnProvider, compoundProvider, aaveProvider, homoraProvider, idleProvider, betaProvider, USDCSigner, IUSDc] = await Promise.all([
      deployYearnProvider(dao, controller.address),
      deployCompoundProvider(dao, controller.address, comptroller),
      deployAaveProvider(dao, controller.address),
      deployHomoraProvider(dao, controller.address),
      deployIdleProvider(dao, controller.address),
      deployBetaProvider(dao, controller.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);

    function getProviderAddress(name: string) {
      if (name.includes('yearn')) return yearnProvider.address;
      if (name.includes('compound')) return compoundProvider.address;
      if (name.includes('aave')) return aaveProvider.address;
      if (name.includes('homora')) return homoraProvider.address;
      if (name.includes('beta')) return betaProvider.address;
      if (name.includes('idle')) return idleProvider.address;
      else return 'none';
    }

    for (const protocol of allProtocols.values()) {
      const {name, protocolToken, underlyingToken, govToken, decimals} = protocol;
      protocol.number = await controllerAddProtocol(
        controller, 
        name, 
        ETFnumber, 
        getProviderAddress(name), 
        protocolToken, 
        underlyingToken, 
        govToken, 
        decimals.toString()
      )     
    }
  
    await Promise.all([
      controller.addVault(gameAddr),
      controller.addVault(vault.address),
      controller.addCurveIndex(dai, 0),
      controller.addCurveIndex(usdc, 1),
      controller.addCurveIndex(usdt, 2),
      IUSDc.connect(USDCSigner).transfer(gameAddr, amountUSDC),
      IUSDc.connect(game).approve(vault.address, amountUSDC),
    ]);
  });

  it("Should", async function() {
    console.log(`-------------------------Deposit-------------------------`); 
    for (const protocol of allProtocols.values()) {
      await protocol.setDeltaAllocation(vault, game, getRandomAllocation());
    }
    
    await vault.depositETF(gameAddr, amountUSDC);
    const gasUsed = await rebalanceETF(vault);

    console.log(`Gas Used $${Number(formatUSDC(gasUsed))}`);
    
    // for (const protocol of allProtocols.values()) {
    //   const balance = await protocol.balanceUnderlying(vault);
    // }
    
    const totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    console.log(totalAllocatedTokens);

  });
});