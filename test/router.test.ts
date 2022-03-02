/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, Router } from '../typechain-types';
import { parseUSDC } from './helpers/helpers';
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { deployAllProviders } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc} from "./helpers/addresses";

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
  addr1Addr: string, 
  vaultAddr: string, 
  addr1: Signer, 
  vault: Signer;

  beforeEach(async function() {
    [dao, addr1, vault] = await ethers.getSigners();

    [daoAddr, addr1Addr, vaultAddr] = await Promise.all([
      dao.getAddress(),
      addr1.getAddress(),
      vault.getAddress(),
    ]);

    // Deploy vault and all providers
    [vaultMock, [yearnProvider, compoundProvider, aaveProvider]] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, userAddr, ETFNumber, router.address, usdc, liquidityPerc),
      deployAllProviders(dao, router, allProtocols),
    ]);

    router = await deployRouter(dao, daoAddr)
  });

  it("Should add a protocol", async function() {
    const ETFNumber = 1;
    const protocolNumber = 1;
    const providerAddress = addr1Addr;

    await router.addProtocol(ETFNumber, protocolNumber, providerAddress, vaultAddr);
    const protocol = await router.protocol(ETFNumber, protocolNumber);

    expect(protocol).to.be.equal(providerAddress);
  });
  
});