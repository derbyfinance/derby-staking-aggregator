/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { MockContract, MockProvider } from "ethereum-waffle";
import { BigNumber, Contract, Signer } from "ethers";
import { ethers, network } from "hardhat";
import { AaveProvider, CompoundProvider, YearnProvider } from "typechain-types";
import { aave, aaveUSDC, aaveUSDT, compoundDAI, compoundUSDC, compToken, comptroller, CompWhale, curve3Pool, dai, usdc, usdt, yearn, yearnUSDC } from "./addresses";
import { deployAaveProvider, deployCompoundProvider, deployETFVaultMock, deployRouter, deployYearnProvider } from "./deploy";
import { deployAaveProviderMock, deployYearnProviderMock, deployCompoundProviderMock } from "./deployMocks";
import { getUSDCSigner, erc20, routerAddProtocol, getWhale, } from './helpers';

export interface Protocol {
  number: number;
  allocation: number;
  address: string;
}

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const ETFname = 'USDC_med_risk';
const ETFnumber = 0;
const decimals = 6;
const uScale = 1E6;

export async function beforeEachETFVault(
  amountUSDC: BigNumber,
  providerMocks: boolean = false
) {
  // stock protocols
  const protocolCompound = { number: 0, allocation: 40, address: compoundUSDC };
  const protocolAave = { number: 0, allocation: 60, address: aaveUSDC };
  const protocolYearn = { number: 0, allocation: 20, address: yearnUSDC };
  const allProtocols = [protocolCompound, protocolAave, protocolYearn];

  // new protocols
  const protocolCompoundDAI = { number: 0, allocation: 0, address: compoundDAI };
  const protocolAaveUSDT = { number: 0, allocation: 0, address: aaveUSDT };

  let yearnProvider, compoundProvider, aaveProvider;
  let yearnProviderMock, compoundProviderMock, aaveProviderMock;
  const [dao, user] = await ethers.getSigners();

  // Get Addresses
  const [daoAddr, userAddr] = await Promise.all([
    dao.getAddress(),
    user.getAddress(),
  ]);
  const router = await deployRouter(dao, daoAddr);
  const vaultMock = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, router.address, usdc, uScale);
  
  // Deploy all providers and Vault
  if (!providerMocks) {
    [compoundProvider, aaveProvider, yearnProvider] = await Promise.all([
      deployCompoundProvider(dao, router.address, comptroller),
      deployAaveProvider(dao, router.address),
      deployYearnProvider(dao, router.address),
    ]);

    [protocolCompound.number, protocolCompoundDAI.number, protocolAave.number, protocolAaveUSDT.number, protocolYearn.number] = await Promise.all([
      routerAddProtocol(router, 'compound_usdc_01', ETFnumber, compoundProvider.address, compoundUSDC, usdc, compToken, 1E6.toString()),
      routerAddProtocol(router, 'compound_dai_01', ETFnumber, compoundProvider.address, compoundDAI, dai, compToken, 1E18.toString()),
      routerAddProtocol(router, 'aave_usdc_01', ETFnumber, aaveProvider.address, aaveUSDC, usdc, aave, 1E6.toString()),
      routerAddProtocol(router, 'aave_usdt_01', ETFnumber, aaveProvider.address, aaveUSDT, usdt, aave, 1E6.toString()),
      routerAddProtocol(router, 'yearn_usdc_01', ETFnumber, yearnProvider.address, yearnUSDC, usdc, yearn, 1E6.toString()),
      router.setClaimable(compoundProvider.address, true),
    ]);
  }

  if (providerMocks) {
    [compoundProviderMock, aaveProviderMock, yearnProviderMock] = await Promise.all([
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
      deployYearnProviderMock(dao),
    ]);

    [protocolCompound.number, protocolCompoundDAI.number, protocolAave.number, protocolAaveUSDT.number, protocolYearn.number] = await Promise.all([
      routerAddProtocol(router, 'compound_usdc_01', ETFnumber, compoundProviderMock.address, compoundUSDC, usdc, compToken, 1E6.toString()),
      routerAddProtocol(router, 'compound_dai_01', ETFnumber, compoundProviderMock.address, compoundDAI, dai, compToken, 1E18.toString()),
      routerAddProtocol(router, 'aave_usdc_01', ETFnumber, aaveProviderMock.address, aaveUSDC, usdc, aave, 1E6.toString()),
      routerAddProtocol(router, 'aave_usdt_01', ETFnumber, aaveProviderMock.address, aaveUSDT, usdt, aave, 1E6.toString()),
      routerAddProtocol(router, 'yearn_usdc_01', ETFnumber, yearnProviderMock.address, yearnUSDC, usdc, yearn, 1E6.toString()),
    ]);
  }

  // Get Signers and interfaces
  const [USDCSigner, compSigner, IUSDc, IComp, IcUSDC] = await Promise.all([
    getUSDCSigner(),
    getWhale(CompWhale),
    erc20(usdc),
    erc20(compToken),
    erc20(compoundUSDC)
  ]);

  // Transfer USDC to User address, add Vault address to router, set Curve pool index
  await Promise.all([
    router.addVault(vaultMock.address),
    router.addVault(userAddr),
    router.addCurveIndex(dai, 0),
    router.addCurveIndex(usdc, 1),
    router.addCurveIndex(usdt, 2),
    IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
    IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(2)),
  ]);

  return Promise.all([
    vaultMock,
    user,
    userAddr,
    [protocolCompound, protocolAave, protocolYearn, protocolCompoundDAI, protocolAaveUSDT],
    allProtocols,
    IUSDc,
    yearnProviderMock as MockContract, 
    compoundProviderMock as MockContract, 
    aaveProviderMock as MockContract,
    USDCSigner,
    router,
    IcUSDC,
    IComp,
    compSigner,
    yearnProvider as YearnProvider,
    compoundProvider as CompoundProvider,
    aaveProvider as AaveProvider,
    dao
  ])
};

