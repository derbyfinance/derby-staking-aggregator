/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, Router } from '../typechain-types';
import { parseUSDC } from './helpers/helpers';
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { deployAllProviders } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, compoundUSDC} from "./helpers/addresses";

const name = 'XaverUSDC';
const symbol = 'xUSDC';
const decimals = 6;
const liquidityPerc = 10;
const amountUSDC = parseUSDC('100000');
const ETFNumber = 1;
let protocolYearn = { number: 1, allocation: 20, address: yusdc };
let protocolCompound = { number: 2, allocation: 40, address: cusdc };
let protocolAave = { number: 5, allocation: 60, address: ausdc };
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy router contract", async () => {
  let yearnProvider: YearnProvider, 
  compoundProvider: CompoundProvider, 
  aaveProvider: AaveProvider, 
  router: Router, 
  dao: Signer, 
  daoAddr: string, 
  userAddr: string, 
  vaultMock: ETFVaultMock, 
  vaultAddr: string, 
  addr1: Signer, 
  vault: Signer;

  beforeEach(async function() {
    [dao, addr1, vault] = await ethers.getSigners();

    [daoAddr, userAddr, vaultAddr] = await Promise.all([
      dao.getAddress(),
      addr1.getAddress(),
      vault.getAddress(),
    ]);

    router = await deployRouter(dao, daoAddr);

    // Deploy vault and all providers
    [vaultMock, [yearnProvider, compoundProvider, aaveProvider]] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, userAddr, ETFNumber, router.address, usdc, liquidityPerc),
      deployAllProviders(dao, router, allProtocols),
    ]);
  });

  it.only("Should add protocols", async function() {
    const ETFNumber = 1;
    const providerAddress = userAddr;

    await router.addProtocol(ETFNumber, 1, providerAddress, vaultAddr);
    await router.addProtocol(ETFNumber, 2, yearnProvider.address, vaultAddr);
    await router.addProtocol(ETFNumber, 3, compoundProvider.address, vaultAddr);
    await router.addProtocol(ETFNumber, 4, aaveProvider.address, vaultAddr);
    const protocol1 = await router.protocol(ETFNumber, 1);
    const protocol2 = await router.protocol(ETFNumber, 2);
    const protocol3 = await router.protocol(ETFNumber, 3);
    const protocol4 = await router.protocol(ETFNumber, 4);

    expect(protocol1).to.be.equal(providerAddress);
    expect(protocol2).to.be.equal(yearnProvider.address);
    expect(protocol3).to.be.equal(compoundProvider.address);
    expect(protocol4).to.be.equal(aaveProvider.address);
  });
  
});