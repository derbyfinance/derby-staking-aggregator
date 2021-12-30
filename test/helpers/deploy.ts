/* eslint-disable prettier/prettier */
import { deployContract } from "ethereum-waffle";
import { Signer, BigNumberish, Wallet } from "ethers";
import type { 
  YearnProvider,
  CompoundProvider, 
  Router,
  BasketToken, 
  ETFGame, 
  XaverToken, 
  IGoverned,
 } from '../../typechain-types';

import YearnProviderArtifact from '../../artifacts/contracts/Providers/YearnProvider.sol/YearnProvider.json';
import CompoundProviderArtifact from '../../artifacts/contracts/Providers/CompoundProvider.sol/CompoundProvider.json';
import IGovernedArtifact from '../../artifacts/contracts/Interfaces/IGoverned.sol/IGoverned.json';
import XaverTokenArtifact from '../../artifacts/contracts/XaverToken.sol/XaverToken.json';
import ETFGameArtifact from '../../artifacts/contracts/ETFgame.sol/ETFGame.json';
import BasketTokenArtifact from '../../artifacts/contracts/BasketToken.sol/BasketToken.json';
import RouterArtifact from '../../artifacts/contracts/Router.sol/Router.json';


export const deployYearnProvider = (deployerSign: Signer, ytoken: string, utoken: string, router: string): Promise<YearnProvider> => {
  return (deployContract(deployerSign, YearnProviderArtifact, [ytoken, utoken, router])) as Promise<YearnProvider>;
};

export const deployCompoundProvider = (deployerSign: Signer, ctoken: string, utoken: string, router: string): Promise<CompoundProvider> => {
  return (deployContract(deployerSign, CompoundProviderArtifact, [ctoken, utoken, router])) as Promise<CompoundProvider>;
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