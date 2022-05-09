/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, controllerAddProtocol, getDAISigner, getUSDTSigner, parseDAI, formatDAI, formatEther, } from '../helpers/helpers';
import type { BetaProvider, Controller, ETFVaultMock, IdleProvider } from '../../typechain-types';
import { deployBetaProvider, deployController, deployETFVaultMock, deployIdleProvider } from '../helpers/deploy';
import { allProtocols, usdc, betaUSDC as busdc} from "../helpers/addresses";
import { userInfo } from "os";

const amount = 1_000_000;
// const amount = Math.floor(Math.random() * 1000000);
const amountUSDC = parseUSDC(amount.toString());
const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const ETFname = 'USDC_med_risk';
const ETFnumber = 0;
const decimals = 6;
const uScale = 1E6;
const gasFeeLiquidity = 10_000 * uScale;

describe("Testing balanceUnderlying for every single protocol", async () => {
  let vault: ETFVaultMock, betaProvider: BetaProvider, idleProvider: IdleProvider, controller: Controller, dao: Signer, game: Signer, USDCSigner: Signer, DAISigner: Signer, USDTSigner: Signer, IUSDc: Contract, IDai: Contract, IUSDt: Contract, bToken: Contract, daoAddr: string, gameAddr: string, protocols: any;

  beforeEach(async function() {
    [dao, game] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    gameAddr = await game.getAddress();
    controller = await deployController(dao, daoAddr);

    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, gameAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    [betaProvider, idleProvider, USDCSigner, IUSDc] = await Promise.all([
      deployBetaProvider(dao, controller.address),
      deployIdleProvider(dao, controller.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);

    function getProviderAddress(name: string) {
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
      IUSDc.connect(USDCSigner).transfer(vault.address, amountUSDC),
      IUSDc.connect(game).approve(betaProvider.address, amountUSDC),
    ]);
  });

  it("Should", async function() {
    bToken = erc20(busdc);
    console.log(`-------------------------Deposit-------------------------`); 
    await allProtocols.get('beta_usdc_01')?.setAllocation(vault, game, 150);
    const allocationTester = await allProtocols.get('beta_usdc_01')?.getDeltaAllocationTEST(vault);
    console.log(allProtocols.get('beta_usdc_01'))
    console.log({allocationTester})

  });


});