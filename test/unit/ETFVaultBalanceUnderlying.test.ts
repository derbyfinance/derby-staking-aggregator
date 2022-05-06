/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, controllerAddProtocol, getDAISigner, getUSDTSigner, parseDAI, formatDAI, formatEther, } from '../helpers/helpers';
import type { BetaProvider, Controller } from '../../typechain-types';
import { deployBetaProvider, deployController } from '../helpers/deploy';
import { allProtocolVaults, usdc, betaUSDC as busdc, betaDAI as bdai, betaUSDT as iusdt, yearn, dai, usdt} from "../helpers/addresses";
import { ProtocolVault } from "@testhelp/addresses";

const amount = 100_000;
// const amount = Math.floor(Math.random() * 1000000);
const amountUSDC = parseUSDC(amount.toString());

const ETFnumber = 0;

describe("Testing Beta provider", async () => {
  let betaProvider: BetaProvider, controller: Controller, dao: Signer, vault: Signer, USDCSigner: Signer, DAISigner: Signer, USDTSigner: Signer, IUSDc: Contract, IDai: Contract, IUSDt: Contract, bToken: Contract, daoAddr: string, vaultAddr: string, protocolNumberUSDC: number, protocolNumberDAI: number, protocolNumberUSDT: number;

  beforeEach(async function() {
    [dao, vault] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    controller = await deployController(dao, daoAddr);

    [vaultAddr, betaProvider, USDCSigner, IUSDc] = await Promise.all([
      vault.getAddress(),
      deployBetaProvider(dao, controller.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);

    const addProtocolPromises = allProtocolVaults.map(({name, protocolToken, underlyingToken, govToken, decimals} : ProtocolVault) => {
        return controllerAddProtocol(
          controller, 
          name, 
          ETFnumber, 
          betaProvider.address, 
          protocolToken, 
          underlyingToken, 
          govToken, 
          decimals.toString()
        )}
    );
    
    console.log({addProtocolPromises});

    [protocolNumberUSDC, protocolNumberDAI, protocolNumberUSDT] = await Promise.all(addProtocolPromises)
    console.log({protocolNumberUSDC})
    console.log({protocolNumberDAI})
    console.log({protocolNumberUSDT})
    
    await Promise.all([
      controller.addVault(vaultAddr),
      IUSDc.connect(USDCSigner).transfer(vaultAddr, amountUSDC),
      IUSDc.connect(vault).approve(betaProvider.address, amountUSDC),
    ]);
  });

  it("Should deposit and withdraw USDC to beta through controller", async function() {
    bToken = await erc20(busdc);
    console.log(`-------------------------Deposit-------------------------`); 
    const vaultBalanceStart = await IUSDc.balanceOf(vaultAddr);

  });


});