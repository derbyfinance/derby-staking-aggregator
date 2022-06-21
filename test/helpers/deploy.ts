/* eslint-disable prettier/prettier */
import { deployContract } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import type { 
  YearnProvider,
  BetaProvider,
  IdleProvider,
  HomoraProvider,
  CompoundProvider, 
  AaveProvider,
  TruefiProvider,
  Controller,
  ETFVault,
  ETFGame, 
  XaverToken, 
  IGoverned,
  ETFVaultMock,
  CompoundProviderMock,
  ETFGameMock,
  TokenTimelock,
  XChainController
 } from '../../typechain-types';

import YearnProviderArtifact from '../../artifacts/contracts/Providers/YearnProvider.sol/YearnProvider.json';
import BetaProviderArtifact from '../../artifacts/contracts/Providers/BetaProvider.sol/BetaProvider.json';
import IdleProviderArtifact from '../../artifacts/contracts/Providers/IdleProvider.sol/IdleProvider.json';
import HomoraProviderArtifact from '../../artifacts/contracts/Providers/HomoraProvider.sol/HomoraProvider.json';
import TruefiProviderArtifact from '../../artifacts/contracts/Providers/TruefiProvider.sol/TruefiProvider.json';
import CompoundProviderArtifact from '../../artifacts/contracts/Providers/CompoundProvider.sol/CompoundProvider.json';
import CompoundProviderMockArtifact from '../../artifacts/contracts/Mocks/CompoundProviderMock.sol/CompoundProviderMock.json';
import AaveProviderArtifact from '../../artifacts/contracts/Providers/AaveProvider.sol/AaveProvider.json';
import ETFVaultArtifact from '../../artifacts/contracts/ETFVault.sol/ETFVault.json';
import TokenTimelockArtifact from '../../artifacts/contracts/TokenTimelock.sol/TokenTimelock.json';
import ETFVaultArtifactMock from '../../artifacts/contracts/Mocks/ETFVaultMock.sol/ETFVaultMock.json';
import IGovernedArtifact from '../../artifacts/contracts/Interfaces/IGoverned.sol/IGoverned.json';
import XaverTokenArtifact from '../../artifacts/contracts/XaverToken.sol/XaverToken.json';
import ETFGameArtifact from '../../artifacts/contracts/ETFGame.sol/ETFGame.json';
import ETFGameMockArtifact from '../../artifacts/contracts/Mocks/ETFGameMock.sol/ETFGameMock.json';
import ControllerArtifact from '../../artifacts/contracts/Controller.sol/Controller.json';
import XChainControllerArtifact from '../../artifacts/contracts/XChainController.sol/XChainController.json';
import { ChainlinkGasPrice, curve3Pool, uniswapQuoter, uniswapRouter } from "./addresses";

export const deployTokenTimeLock = (
  deployerSign: Signer, 
  tokenAddr: string, 
): Promise<TokenTimelock> => {
  return (deployContract(deployerSign, TokenTimelockArtifact, [tokenAddr])) as Promise<TokenTimelock>;
};

export const deployBetaProvider = (deployerSign: Signer, controller: string): Promise<BetaProvider> => {
  return (deployContract(deployerSign, BetaProviderArtifact, [controller])) as Promise<BetaProvider>;
};

export const deployIdleProvider = (deployerSign: Signer, controller: string): Promise<IdleProvider> => {
  return (deployContract(deployerSign, IdleProviderArtifact, [controller])) as Promise<IdleProvider>;
};

export const deployHomoraProvider = (deployerSign: Signer, controller: string): Promise<HomoraProvider> => {
  return (deployContract(deployerSign, HomoraProviderArtifact, [controller])) as Promise<HomoraProvider>;
};

export const deployYearnProvider = (deployerSign: Signer, controller: string): Promise<YearnProvider> => {
  return (deployContract(deployerSign, YearnProviderArtifact, [controller])) as Promise<YearnProvider>;
};

export const deployTruefiProvider = (deployerSign: Signer, controller: string): Promise<TruefiProvider> => {
  return (deployContract(deployerSign, TruefiProviderArtifact, [controller])) as Promise<TruefiProvider>;
};

export const deployCompoundProvider = (deployerSign: Signer, controller: string, comptroller: string): Promise<CompoundProvider> => {
  return (deployContract(deployerSign, CompoundProviderArtifact, [controller, comptroller])) as Promise<CompoundProvider>;
};

export const deployCompoundProviderMock = (deployerSign: Signer, controller: string, comptroller: string): Promise<CompoundProviderMock> => {
  return (deployContract(deployerSign, CompoundProviderMockArtifact, [controller, comptroller])) as Promise<CompoundProviderMock>;
};

export const deployAaveProvider = (deployerSign: Signer, controller: string): Promise<AaveProvider> => {
  return (deployContract(deployerSign, AaveProviderArtifact, [controller])) as Promise<AaveProvider>;
};

export const deployETFVault = (
  deployerSign: Signer, 
  name: string, 
  symbol: string, 
  decimals: number, 
  ETFname: string,
  ETFnumber: number,
  daoAddress: string,
  ETFGame: string, 
  controller: string, 
  vaultCurrency: string, 
  uScale: number,
  gasFeeLiq: number
  ) => deployContract(
    deployerSign, 
    ETFVaultArtifact, 
    [name, symbol, decimals, ETFname, ETFnumber, daoAddress, ETFGame, controller, vaultCurrency, uScale, gasFeeLiq]
  ) as Promise<ETFVault>;

export const deployETFVaultMock = (
  deployerSign: Signer, 
  name: string, 
  symbol: string, 
  decimals: number, 
  ETFname: string,
  ETFnumber: number,
  daoAddress: string, 
  ETFGame: string,
  controller: string, 
  vaultCurrency: string,
  uScale: number, 
  gasFeeLiq: number
  ) => deployContract(
    deployerSign, 
    ETFVaultArtifactMock, 
    [name, symbol, decimals, ETFname, ETFnumber, daoAddress, ETFGame, controller, vaultCurrency, uScale, gasFeeLiq]
  ) as Promise<ETFVaultMock>;

export const deployController = (
  deployerSign: Signer, 
  daoAddress: string, 
): Promise<Controller> => {
  return (deployContract(
    deployerSign, 
    ControllerArtifact, 
    [daoAddress, curve3Pool, uniswapRouter, uniswapQuoter, 3000, ChainlinkGasPrice]
  ) as Promise<Controller>);
};

export const deployXChainController = (deployerSign: Signer, game: string, dao: string): Promise<XChainController> => {
  return (deployContract(deployerSign, XChainControllerArtifact, [game, dao])) as Promise<XChainController>;
};


export const deployIGoverned = (deployerSign: Signer, daoAddress: string, guardianAddress: string): Promise<IGoverned> => {
    return (deployContract(deployerSign, IGovernedArtifact, [daoAddress, guardianAddress])) as Promise<IGoverned>;
};

export const deployXaverToken = (deployerSign: Signer, name: string, symbol: string, totalXaverSupply: BigNumber): Promise<XaverToken> => {
    return (deployContract(deployerSign, XaverTokenArtifact, [name, symbol, totalXaverSupply])) as Promise<XaverToken>;
};

export const deployETFGame = (deployerSign: Signer, XaverTokenAddress: string, routerAddress: string, governedAddress: string, controllerAddress: string): Promise<ETFGame> => {
    return (deployContract(deployerSign, ETFGameArtifact, [XaverTokenAddress, routerAddress, governedAddress, controllerAddress])) as Promise<ETFGame>;
};

export const deployETFGameMock = (deployerSign: Signer, name: string, symbol: string, XaverTokenAddress: string, routerAddress: string, governedAddress: string, controllerAddress: string): Promise<ETFGameMock> => {
  return (deployContract(deployerSign, ETFGameMockArtifact, [name, symbol, XaverTokenAddress, routerAddress, governedAddress, controllerAddress])) as Promise<ETFGameMock>;
};
