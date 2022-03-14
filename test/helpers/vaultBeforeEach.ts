/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { MockContract, MockProvider } from "ethereum-waffle";
import { BigNumber, Contract, Signer } from "ethers";
import { ethers, network } from "hardhat";
import { AaveProvider, CompoundProvider, YearnProvider } from "typechain-types";
import { aave, aaveUSDC, compoundUSDC, compToken, comptroller, CompWhale, usdc, yearn, yearnUSDC } from "./addresses";
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
const decimals = 6;
const uScale = 1E6;

export async function beforeEachETFVault(
  amountUSDC: BigNumber,
  providerMocks: boolean = false
) {
  const protocolCompound = { number: 0, allocation: 40, address: compoundUSDC };
  const protocolAave = { number: 0, allocation: 60, address: aaveUSDC };
  const protocolYearn = { number: 0, allocation: 20, address: yearnUSDC };
  const allProtocols = [protocolCompound, protocolAave, protocolYearn];

  let yearnProvider, compoundProvider, aaveProvider;
  let yearnProviderMock, compoundProviderMock, aaveProviderMock;
  const [dao, user] = await ethers.getSigners();

  // Get Addresses
  const [daoAddr, userAddr] = await Promise.all([
    dao.getAddress(),
    user.getAddress(),
  ]);
  const router = await deployRouter(dao, daoAddr);
  const vaultMock = await deployETFVaultMock(dao, name, symbol, decimals, daoAddr, userAddr, router.address, usdc, uScale);
  
  // Deploy all providers and Vault
  if (!providerMocks) {
    [compoundProvider, aaveProvider, yearnProvider] = await Promise.all([
      deployCompoundProvider(dao, router.address, comptroller),
      deployAaveProvider(dao, router.address),
      deployYearnProvider(dao, router.address),
    ]);

    [protocolCompound.number, protocolAave.number, protocolYearn.number] = await Promise.all([
      routerAddProtocol(router, compoundProvider.address, compoundUSDC, usdc, compToken),
      routerAddProtocol(router, aaveProvider.address, aaveUSDC, usdc, aave),
      routerAddProtocol(router, yearnProvider.address, yearnUSDC, usdc, yearn),
      router.setClaimable(compoundProvider.address, true),
    ]);
  }

  if (providerMocks) {
    [compoundProviderMock, aaveProviderMock, yearnProviderMock] = await Promise.all([
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
      deployYearnProviderMock(dao),
    ]);

    [protocolCompound.number, protocolAave.number, protocolYearn.number] = await Promise.all([
      routerAddProtocol(router, compoundProviderMock.address, compoundUSDC, usdc, compToken),
      routerAddProtocol(router, aaveProviderMock.address, aaveUSDC, usdc, aave),
      routerAddProtocol(router, yearnProviderMock.address, yearnUSDC, usdc, yearn),
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

  // Transfer USDC to User address and add Vault address to router
  await Promise.all([
    router.addVault(vaultMock.address),
    router.addVault(userAddr),
    IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
    IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(2)),
  ]);

  return Promise.all([
    vaultMock,
    user,
    userAddr,
    allProtocols,
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
    aaveProvider as AaveProvider
  ])
};


