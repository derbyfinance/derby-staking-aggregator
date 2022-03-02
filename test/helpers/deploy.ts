/* eslint-disable prettier/prettier */
import { deployContract } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import type { 
  YearnProvider,
  CompoundProvider, 
  AaveProvider,
  Router,
  ETFVault,
  BasketToken, 
  ETFGame, 
  XaverToken, 
  IGoverned,
  ETFVaultMock,
  CompoundProviderMock
 } from '../../typechain-types';

import YearnProviderArtifact from '../../artifacts/contracts/Providers/YearnProvider.sol/YearnProvider.json';
import CompoundProviderArtifact from '../../artifacts/contracts/Providers/CompoundProvider.sol/CompoundProvider.json';
import CompoundProviderMockArtifact from '../../artifacts/contracts/Mocks/CompoundProviderMock.sol/CompoundProviderMock.json';
import AaveProviderArtifact from '../../artifacts/contracts/Providers/AaveProvider.sol/AaveProvider.json';
import ETFVaultArtifact from '../../artifacts/contracts/ETFVault.sol/ETFVault.json';
import ETFVaultArtifactMock from '../../artifacts/contracts/Mocks/ETFVaultMock.sol/ETFVaultMock.json';
import IGovernedArtifact from '../../artifacts/contracts/Interfaces/IGoverned.sol/IGoverned.json';
import XaverTokenArtifact from '../../artifacts/contracts/XaverToken.sol/XaverToken.json';
import ETFGameArtifact from '../../artifacts/contracts/ETFGame.sol/ETFGame.json';
import BasketTokenArtifact from '../../artifacts/contracts/BasketToken.sol/BasketToken.json';
import RouterArtifact from '../../artifacts/contracts/Router.sol/Router.json';


export const deployYearnProvider = (deployerSign: Signer, router: string): Promise<YearnProvider> => {
  return (deployContract(deployerSign, YearnProviderArtifact, [router])) as Promise<YearnProvider>;
};

export const deployCompoundProvider = (deployerSign: Signer, router: string, comptroller: string): Promise<CompoundProvider> => {
  return (deployContract(deployerSign, CompoundProviderArtifact, [router, comptroller])) as Promise<CompoundProvider>;
};

export const deployCompoundProviderMock = (deployerSign: Signer, router: string, comptroller: string): Promise<CompoundProviderMock> => {
  return (deployContract(deployerSign, CompoundProviderMockArtifact, [router, comptroller])) as Promise<CompoundProviderMock>;
};

export const deployAaveProvider = (deployerSign: Signer, router: string): Promise<AaveProvider> => {
  return (deployContract(deployerSign, AaveProviderArtifact, [router])) as Promise<AaveProvider>;
};

export const deployETFVault = (deployerSign: Signer, name: string, symbol: string, decimals: number, daoAddress: string, ETFNumber: number, router: string, vaultCurrency: string, threshold: number): Promise<ETFVault> => {
  return (deployContract(deployerSign, ETFVaultArtifact, [name, symbol, decimals, daoAddress, ETFNumber, router, vaultCurrency, threshold])) as Promise<ETFVault>;
};

export const deployETFVaultMock = (deployerSign: Signer, name: string, symbol: string, decimals: number, daoAddress: string, ETFNumber: number, router: string, vaultCurrency: string, threshold: BigNumber): Promise<ETFVaultMock> => {
  return (deployContract(deployerSign, ETFVaultArtifactMock, [name, symbol, decimals, daoAddress, ETFNumber, router, vaultCurrency, threshold])) as Promise<ETFVaultMock>;
};

export const deployRouter = (deployerSign: Signer, daoAddress: string): Promise<Router> => {
  return (deployContract(deployerSign, RouterArtifact,  [daoAddress]) as Promise<Router>);
};

export const deployIGoverned = (deployerSign: Signer, daoAddress: string, guardianAddress: string): Promise<IGoverned> => {
    return (deployContract(deployerSign, IGovernedArtifact, [daoAddress, guardianAddress])) as Promise<IGoverned>;
};

export const deployXaverToken = (deployerSign: Signer, name: string, symbol: string): Promise<XaverToken> => {
    return (deployContract(deployerSign, XaverTokenArtifact, [name, symbol])) as Promise<XaverToken>;
};

export const deployETFGame = (deployerSign: Signer, XaverTokenAddress: string, governedAddress: string): Promise<ETFGame> => {
    return (deployContract(deployerSign, ETFGameArtifact, [XaverTokenAddress, governedAddress])) as Promise<ETFGame>;
};

export const deployBasketToken = (deployerSign: Signer, ETFgame: string, name: string, symbol: string): Promise<BasketToken> => {
    return (deployContract(deployerSign, BasketTokenArtifact, [ETFgame, name, symbol])) as Promise<BasketToken>;
};