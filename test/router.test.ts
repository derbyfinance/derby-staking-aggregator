/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, Router } from '../typechain-types';
import { parseUSDC } from './helpers/helpers';
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { deployAllProviders } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, yearn, compToken, aave} from "./helpers/addresses";

const name = 'XaverUSDC';
const symbol = 'xUSDC';
const decimals = 6;
const liquidityPerc = 10;
const amountUSDC = parseUSDC('100000');
let protocolYearn = { number: 1, allocation: 20, address: yusdc };
let protocolCompound = { number: 2, allocation: 40, address: cusdc };
let protocolAave = { number: 5, allocation: 60, address: ausdc };

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
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, userAddr, router.address, usdc, liquidityPerc),
      deployAllProviders(dao, router),
    ]);
  });

  it("Should add protocols", async function() {
    const providerAddress = userAddr;

    await router.addProtocol(yearnProvider.address, yusdc, usdc, yearn);
    await router.addProtocol(compoundProvider.address, cusdc, usdc, compToken);
    await router.addProtocol(aaveProvider.address, ausdc, usdc, aave);
    const protocol1 = await router.protocolProvider(1);
    const protocol2 = await router.protocolProvider(2);
    const protocol3 = await router.protocolProvider(3);

    expect(protocol1).to.be.equal(yearnProvider.address);
    expect(protocol2).to.be.equal(compoundProvider.address);
    expect(protocol3).to.be.equal(aaveProvider.address);
  });
  
});