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

  it("Should add protocols and correctly set router mappings", async function() {
    const providerAddress = userAddr;

    await router.addProtocol(yearnProvider.address, yusdc, usdc, yearn);
    await router.addProtocol(compoundProvider.address, cusdc, usdc, compToken);
    await router.addProtocol(aaveProvider.address, ausdc, usdc, aave);

    // check protocol provider
    const protocol1 = await router.protocolProvider(1);
    const protocol2 = await router.protocolProvider(2);
    const protocol3 = await router.protocolProvider(3);

    expect(protocol1.toUpperCase()).to.be.equal(yearnProvider.address.toUpperCase());
    expect(protocol2.toUpperCase()).to.be.equal(compoundProvider.address.toUpperCase());
    expect(protocol3.toUpperCase()).to.be.equal(aaveProvider.address.toUpperCase());

    // check protocol lp token
    const LPtoken1 = await router.protocolLPToken(1);
    const LPtoken2 = await router.protocolLPToken(2);
    const LPtoken3 = await router.protocolLPToken(3);

    expect(LPtoken1.toUpperCase()).to.be.equal(yusdc.toUpperCase());
    expect(LPtoken2.toUpperCase()).to.be.equal(cusdc.toUpperCase());
    expect(LPtoken3.toUpperCase()).to.be.equal(ausdc.toUpperCase());
    
    // check protocol underlying
    const underlying1 = await router.protocolUnderlying(1);
    const underlying2 = await router.protocolUnderlying(2);
    const underlying3 = await router.protocolUnderlying(3);

    expect(underlying1.toUpperCase()).to.be.equal(usdc.toUpperCase());
    expect(underlying2.toUpperCase()).to.be.equal(usdc.toUpperCase());
    expect(underlying3.toUpperCase()).to.be.equal(usdc.toUpperCase());

    // check protocol gov token
    const gov1 = await router.protocolGovToken(1);
    const gov2 = await router.protocolGovToken(2);
    const gov3 = await router.protocolGovToken(3);

    expect(gov1.toUpperCase()).to.be.equal(yearn.toUpperCase());
    expect(gov2.toUpperCase()).to.be.equal(compToken.toUpperCase());
    expect(gov3.toUpperCase()).to.be.equal(aave.toUpperCase());
  });
  
});