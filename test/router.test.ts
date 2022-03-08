/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { ethers } from "hardhat";
import { MockContract } from "ethereum-waffle";
import type { Router } from '../typechain-types';
import { getUSDCSigner, erc20  } from './helpers/helpers';
import { deployRouter } from './helpers/deploy';
import { deployAaveProviderMock, deployCompoundProviderMock, deployYearnProviderMock } from './helpers/deployMocks';
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc, yearn, compToken, aave} from "./helpers/addresses";

const yearnMock = Math.floor(Math.random() * 100000);
const compoundMock =  Math.floor(Math.random() * 100000);
const aaveMock =  Math.floor(Math.random() * 100000);

describe("Deploy router contract", async () => {
  let yearnProviderMock: MockContract, 
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
    [yearnProviderMock, compoundProviderMock, aaveProviderMock, USDCSigner, IUSDc] = await Promise.all([
      deployYearnProviderMock(dao),
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
      getUSDCSigner(),
      erc20(usdc),
    ]);

    await router.addVault(vaultAddr);

    await router.addProtocol(yearnProviderMock.address, yusdc, usdc, yearn); // 1
    await router.addProtocol(compoundProviderMock.address, cusdc, usdc, compToken); // 2
    await router.addProtocol(aaveProviderMock.address, ausdc, usdc, aave); // 3
  }); 

  it("Should correctly set router mappings", async function() {
    const [protocol1, protocol2, protocol3] = await Promise.all([
      router.protocolProvider(1),
      router.protocolProvider(2),
      router.protocolProvider(3),
    ])

    expect(protocol1.toUpperCase()).to.be.equal(yearnProviderMock.address.toUpperCase());
    expect(protocol2.toUpperCase()).to.be.equal(compoundProviderMock.address.toUpperCase());
    expect(protocol3.toUpperCase()).to.be.equal(aaveProviderMock.address.toUpperCase());

    // check protocol lp token
    const [LPtoken1, LPtoken2, LPtoken3] = await Promise.all([
      router.protocolLPToken(1),
      router.protocolLPToken(2),
      router.protocolLPToken(3),
    ])

    expect(LPtoken1.toUpperCase()).to.be.equal(yusdc.toUpperCase());
    expect(LPtoken2.toUpperCase()).to.be.equal(cusdc.toUpperCase());
    expect(LPtoken3.toUpperCase()).to.be.equal(ausdc.toUpperCase());
    
    // check protocol underlying
    const [underlying1, underlying2, underlying3] = await Promise.all([
      router.protocolUnderlying(1),
      router.protocolUnderlying(2),
      router.protocolUnderlying(3),
    ])

    expect(underlying1.toUpperCase()).to.be.equal(usdc.toUpperCase());
    expect(underlying2.toUpperCase()).to.be.equal(usdc.toUpperCase());
    expect(underlying3.toUpperCase()).to.be.equal(usdc.toUpperCase());

    // check protocol gov token
    const [gov1, gov2, gov3] = await Promise.all([
      router.protocolGovToken(1),
      router.protocolGovToken(2),
      router.protocolGovToken(3),
    ])

    expect(gov1.toUpperCase()).to.be.equal(yearn.toUpperCase());
    expect(gov2.toUpperCase()).to.be.equal(compToken.toUpperCase());
    expect(gov3.toUpperCase()).to.be.equal(aave.toUpperCase());
  });

  it("Should correctly set router to deposit", async function() {
    await Promise.all([
      yearnProviderMock.mock.deposit.returns(yearnMock),
      compoundProviderMock.mock.deposit.returns(compoundMock),
      aaveProviderMock.mock.deposit.returns(aaveMock),
    ]);

    let returnValueYearn = await router.connect(vaultSigner).deposit(1, vaultAddr, 0);
    let returnValueCompound = await router.connect(vaultSigner).deposit(2, vaultAddr, 0)
    let returnValueAave = await router.connect(vaultSigner).deposit(3, vaultAddr, 0)

    expect(returnValueYearn.from.toUpperCase()).to.be.equal(vaultAddr.toUpperCase());
    expect(returnValueCompound.from.toUpperCase()).to.be.equal(vaultAddr.toUpperCase());
    expect(returnValueAave.from.toUpperCase()).to.be.equal(vaultAddr.toUpperCase());
  });

  it("Should correctly set router to withdraw", async function() {
    await Promise.all([
      yearnProviderMock.mock.withdraw.returns(yearnMock),
      compoundProviderMock.mock.withdraw.returns(compoundMock),
      aaveProviderMock.mock.withdraw.returns(aaveMock),
    ]);

    let returnValueYearn = await router.connect(vaultSigner).withdraw(1, vaultAddr, 0);
    let returnValueCompound = await router.connect(vaultSigner).withdraw(2, vaultAddr, 0);
    let returnValueAave = await router.connect(vaultSigner).withdraw(3, vaultAddr, 0);

    expect(returnValueYearn.from.toUpperCase()).to.be.equal(vaultAddr.toUpperCase());
    expect(returnValueCompound.from.toUpperCase()).to.be.equal(vaultAddr.toUpperCase());
    expect(returnValueAave.from.toUpperCase()).to.be.equal(vaultAddr.toUpperCase());
  });

  it("Should correctly set router to exchangeRate", async function() {
    await Promise.all([
      yearnProviderMock.mock.exchangeRate.returns(yearnMock),
      compoundProviderMock.mock.exchangeRate.returns(compoundMock),
      aaveProviderMock.mock.exchangeRate.returns(aaveMock),
    ]);

    expect(await router.connect(vaultSigner).exchangeRate(1)).to.be.equal(yearnMock);
    expect(await router.connect(vaultSigner).exchangeRate(2)).to.be.equal(compoundMock);
    expect(await router.connect(vaultSigner).exchangeRate(3)).to.be.equal(aaveMock);
  });

  it("Should correctly set router to balance", async function() {
    await Promise.all([
      yearnProviderMock.mock.balance.returns(yearnMock),
      compoundProviderMock.mock.balance.returns(compoundMock),
      aaveProviderMock.mock.balance.returns(aaveMock),
    ]);

    expect(await router.connect(vaultSigner).balance(1, vaultAddr)).to.be.equal(yearnMock);
    expect(await router.connect(vaultSigner).balance(2, vaultAddr)).to.be.equal(compoundMock);
    expect(await router.connect(vaultSigner).balance(3, vaultAddr)).to.be.equal(aaveMock);
  });

  it("Should correctly set router to balanceUnderlying", async function() {
    await Promise.all([
      yearnProviderMock.mock.balanceUnderlying.returns(yearnMock),
      compoundProviderMock.mock.balanceUnderlying.returns(compoundMock),
      aaveProviderMock.mock.balanceUnderlying.returns(aaveMock),
    ]);

    expect(await router.connect(vaultSigner).balanceUnderlying(1, vaultAddr)).to.be.equal(yearnMock);
    expect(await router.connect(vaultSigner).balanceUnderlying(2, vaultAddr)).to.be.equal(compoundMock);
    expect(await router.connect(vaultSigner).balanceUnderlying(3, vaultAddr)).to.be.equal(aaveMock);    
  });

  it("Should correctly set router to calcShares", async function() {
    await Promise.all([
      yearnProviderMock.mock.calcShares.returns(yearnMock),
      compoundProviderMock.mock.calcShares.returns(compoundMock),
      aaveProviderMock.mock.calcShares.returns(aaveMock),
    ]);

    expect(await router.connect(vaultSigner).calcShares(1, 0)).to.be.equal(yearnMock);
    expect(await router.connect(vaultSigner).calcShares(2, 0)).to.be.equal(compoundMock);
    expect(await router.connect(vaultSigner).calcShares(3, 0)).to.be.equal(aaveMock);   
  });
});