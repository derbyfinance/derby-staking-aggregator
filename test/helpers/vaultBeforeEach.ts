/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { BigNumber, Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { AaveProvider, CompoundProvider, ETFVaultMock, Router, YearnProvider } from "typechain-types";
import { aave, aaveUSDC, compoundUSDC, compToken, comptroller, CompWhale, usdc, yearn, yearnUSDC } from "./addresses";
import { deployAaveProvider, deployCompoundProvider, deployETFVaultMock, deployRouter, deployYearnProvider } from "./deploy";
import { getUSDCSigner, erc20, routerAddProtocol, getWhale, } from './helpers';

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const uScale = 1E6;

const protocolCompound = { number: 0, allocation: 40, address: compoundUSDC };
const protocolAave = { number: 0, allocation: 60, address: aaveUSDC };
const protocolYearn = { number: 0, allocation: 20, address: yearnUSDC };

export const allProtocols = [protocolCompound, protocolAave, protocolYearn];

export async function beforeEachVault(
  yearnProvider: YearnProvider, 
  compoundProvider: CompoundProvider, 
  aaveProvider: AaveProvider,
  vaultMock: ETFVaultMock,
  dao: Signer,
  daoAddr: string,
  user: Signer,
  userAddr: string,
  router: Router,
  USDCSigner: Signer, 
  IUSDc: Contract,
  IcUSDC: Contract,
  IComp: Contract,
  compSigner: Signer,
  amountUSDC: BigNumber,
) {
  [dao, user] = await ethers.getSigners();

  // Get Addresses and deploy router
  [daoAddr, userAddr, router] = await Promise.all([
    dao.getAddress(),
    user.getAddress(),
    deployRouter(dao, daoAddr),
  ]);

  // Deploy all providers and Vault
  [vaultMock, yearnProvider, compoundProvider, aaveProvider] = await Promise.all([
    deployETFVaultMock(dao, name, symbol, decimals, daoAddr, userAddr, router.address, usdc, uScale),
    deployYearnProvider(dao, router.address),
    deployCompoundProvider(dao, router.address, comptroller),
    deployAaveProvider(dao, router.address),
  ]);

  // Get Signers and interfaces
  [USDCSigner, compSigner, IUSDc, IComp, IcUSDC] = await Promise.all([
    getUSDCSigner(),
    getWhale(CompWhale),
    erc20(usdc),
    erc20(compToken),
    erc20(compoundUSDC)
  ]);
  
  // Add Protocols to router and set protocol numbers
  [protocolCompound.number, protocolAave.number, protocolYearn.number] = await Promise.all([
    routerAddProtocol(router, compoundProvider.address, compoundUSDC, usdc, compToken),
    routerAddProtocol(router, aaveProvider.address, aaveUSDC, usdc, aave),
    routerAddProtocol(router, yearnProvider.address, yearnUSDC, usdc, yearn),
  ]);

  // Transfer USDC to User address and add Vault address to router
  await Promise.all([
    router.addVault(vaultMock.address),
    IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
    IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(2)),
  ])

  return [
    yearnProvider, 
    compoundProvider, 
    aaveProvider,
    vaultMock,
    user,
    userAddr,
    router,
    USDCSigner,
    IUSDc,
    IcUSDC,
    IComp,
    compSigner
  ]
};