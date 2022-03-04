/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { ethers } from "hardhat";
import { MockContract } from "ethereum-waffle";
import type { YearnProvider, CompoundProvider, AaveProvider, Router } from '../typechain-types';
import { parseUSDC, getUSDCSigner, erc20  } from './helpers/helpers';
import { deployRouter } from './helpers/deploy';
import { deployAllProviders } from "./helpers/vaultHelpers";
import { deployAaveProviderMock, deployCompoundProviderMock, deployYearnProviderMock } from './helpers/deployMocks';
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, yearn, compToken, aave} from "./helpers/addresses";

const name = 'XaverUSDC';
const symbol = 'xUSDC';
const decimals = 6;
const liquidityPerc = 10;
const amountUSDC = parseUSDC('12345');

describe("Deploy router contract", async () => {
  let yearnProvider: YearnProvider, 
  compoundProvider: CompoundProvider, 
  aaveProvider: AaveProvider,
  yearnProviderMock: MockContract, 
  compoundProviderMock: MockContract, 
  aaveProviderMock: MockContract, 
  router: Router, 
  dao: Signer, 
  daoAddr: string, 
  userAddr: string, 
  vaultAddr: string,
  addr1: Signer, 
  USDCSigner: Signer, 
  vaultSigner: Signer,
  IUSDc: Contract;

  beforeEach(async function() {
    [dao, addr1, vaultSigner] = await ethers.getSigners();

    [daoAddr, userAddr, vaultAddr] = await Promise.all([
      dao.getAddress(),
      addr1.getAddress(),
      vaultSigner.getAddress(),
    ]);

    router = await deployRouter(dao, daoAddr);
    
    // Deploy vault and all providers
    [yearnProviderMock, compoundProviderMock, aaveProviderMock, [yearnProvider, compoundProvider, aaveProvider], USDCSigner, IUSDc] = await Promise.all([
      deployYearnProviderMock(dao),
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
      deployAllProviders(dao, router),
      getUSDCSigner(),
      erc20(usdc),
    ]);

    await router.addVault(vaultAddr);

    IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
    IUSDc.connect(addr1).approve(router.address, amountUSDC.mul(2)),

    await router.addProtocol(yearnProvider.address, yusdc, usdc, yearn); // 1
    await router.addProtocol(compoundProvider.address, cusdc, usdc, compToken); // 2
    await router.addProtocol(aaveProvider.address, ausdc, usdc, aave); // 3
    await router.addProtocol(yearnProviderMock.address, yusdc, usdc, yearn); // 4
    await router.addProtocol(compoundProviderMock.address, cusdc, usdc, compToken); // 5
    await router.addProtocol(aaveProviderMock.address, ausdc, usdc, aave); // 6
  }); 

  it("Should correctly set router mappings", async function() {
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

  it("Should correctly set route to exchangeRate", async function() {
    await Promise.all([
      yearnProviderMock.mock.exchangeRate.returns(11),
      compoundProviderMock.mock.exchangeRate.returns(22),
      aaveProviderMock.mock.exchangeRate.returns(33),
    ]);

    expect(await router.connect(vaultSigner).exchangeRate(4)).to.be.equal(11);
    expect(await router.connect(vaultSigner).exchangeRate(5)).to.be.equal(22);
    expect(await router.connect(vaultSigner).exchangeRate(6)).to.be.equal(33);
  });

  it("Should correctly set route to balance", async function() {
    await Promise.all([
      yearnProviderMock.mock.balance.returns(11),
      compoundProviderMock.mock.balance.returns(22),
      aaveProviderMock.mock.balance.returns(33),
    ]);

    expect(await router.connect(vaultSigner).balance(4, vaultAddr)).to.be.equal(11);
    expect(await router.connect(vaultSigner).balance(5, vaultAddr)).to.be.equal(22);
    expect(await router.connect(vaultSigner).balance(6, vaultAddr)).to.be.equal(33);
  });

  it("Should correctly set route to balanceUnderlying", async function() {
    await Promise.all([
      yearnProviderMock.mock.balanceUnderlying.returns(11),
      compoundProviderMock.mock.balanceUnderlying.returns(22),
      aaveProviderMock.mock.balanceUnderlying.returns(33),
    ]);

    expect(await router.connect(vaultSigner).balanceUnderlying(4, vaultAddr)).to.be.equal(11);
    expect(await router.connect(vaultSigner).balanceUnderlying(5, vaultAddr)).to.be.equal(22);
    expect(await router.connect(vaultSigner).balanceUnderlying(6, vaultAddr)).to.be.equal(33);    
  });

  it("Should correctly set route to calcShares", async function() {
    await Promise.all([
      yearnProviderMock.mock.calcShares.returns(11),
      compoundProviderMock.mock.calcShares.returns(22),
      aaveProviderMock.mock.calcShares.returns(33),
    ]);

    expect(await router.connect(vaultSigner).calcShares(4, 0)).to.be.equal(11);
    expect(await router.connect(vaultSigner).calcShares(5, 0)).to.be.equal(22);
    expect(await router.connect(vaultSigner).calcShares(6, 0)).to.be.equal(33);   
  });
  
});