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
  Vault,
  Game, 
  DerbyToken, 
  IGoverned,
  VaultMock,
  CompoundProviderMock,
  GameMock,
  TokenTimelock,
  XChainController,
  XProvider,
  ConnextXProviderMock,
  ConnextExecutorMock,
  ConnextHandlerMock,
  XReceiveMock,
  XSendMock,
  XChainControllerMock,
 } from '../../typechain-types';

import YearnProviderArtifact from '../../artifacts/contracts/Providers/YearnProvider.sol/YearnProvider.json';
import BetaProviderArtifact from '../../artifacts/contracts/Providers/BetaProvider.sol/BetaProvider.json';
import IdleProviderArtifact from '../../artifacts/contracts/Providers/IdleProvider.sol/IdleProvider.json';
import HomoraProviderArtifact from '../../artifacts/contracts/Providers/HomoraProvider.sol/HomoraProvider.json';
import TruefiProviderArtifact from '../../artifacts/contracts/Providers/TruefiProvider.sol/TruefiProvider.json';
import CompoundProviderArtifact from '../../artifacts/contracts/Providers/CompoundProvider.sol/CompoundProvider.json';
import CompoundProviderMockArtifact from '../../artifacts/contracts/Mocks/CompoundProviderMock.sol/CompoundProviderMock.json';
import AaveProviderArtifact from '../../artifacts/contracts/Providers/AaveProvider.sol/AaveProvider.json';
import VaultArtifact from '../../artifacts/contracts/Vault.sol/Vault.json';
import TokenTimelockArtifact from '../../artifacts/contracts/TokenTimelock.sol/TokenTimelock.json';
import VaultArtifactMock from '../../artifacts/contracts/Mocks/VaultMock.sol/VaultMock.json';
import IGovernedArtifact from '../../artifacts/contracts/Interfaces/IGoverned.sol/IGoverned.json';
import DerbyTokenArtifact from '../../artifacts/contracts/DerbyToken.sol/DerbyToken.json';
import GameArtifact from '../../artifacts/contracts/Game.sol/Game.json';
import GameMockArtifact from '../../artifacts/contracts/Mocks/GameMock.sol/GameMock.json';
import ControllerArtifact from '../../artifacts/contracts/Controller.sol/Controller.json';
import XChainControllerArtifact from '../../artifacts/contracts/XChainController.sol/XChainController.json';
import XChainControllerMockArtifact from '../../artifacts/contracts/Mocks/XChainControllerMock.sol/XChainControllerMock.json';
import XProviderArtifact from '../../artifacts/contracts/XProvider.sol/XProvider.json';
import ConnextXProviderMockArtifact from '../../artifacts/contracts/Mocks/ConnextXProviderMock.sol/ConnextXProviderMock.json';
import ConnextExecutorMockArtifact from '../../artifacts/contracts/Mocks/ConnextExecutorMock.sol/ConnextExecutorMock.json';
import ConnextHandlerMockArtifact from '../../artifacts/contracts/Mocks/ConnextHandlerMock.sol/ConnextHandlerMock.json';
import XReceiveMockArtifact from '../../artifacts/contracts/Mocks/XReceiveMock.sol/XReceiveMock.json';
import XSendMockArtifact from '../../artifacts/contracts/Mocks/XSendMock.sol/XSendMock.json';
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

export const deployVault = (
  deployerSign: Signer, 
  name: string, 
  symbol: string, 
  decimals: number, 
  ETFname: string,
  ETFnumber: number,
  daoAddress: string,
  Game: string, 
  controller: string, 
  vaultCurrency: string, 
  uScale: number,
  gasFeeLiq: number
  ) => deployContract(
    deployerSign, 
    VaultArtifact, 
    [name, symbol, decimals, ETFname, ETFnumber, daoAddress, Game, controller, vaultCurrency, uScale, gasFeeLiq]
  ) as Promise<Vault>;

export const deployVaultMock = (
  deployerSign: Signer, 
  name: string, 
  symbol: string, 
  decimals: number, 
  ETFname: string,
  ETFnumber: number,
  daoAddress: string, 
  Game: string,
  controller: string, 
  vaultCurrency: string,
  uScale: number, 
  gasFeeLiq: number
  ) => deployContract(
    deployerSign, 
    VaultArtifactMock, 
    [name, symbol, decimals, ETFname, ETFnumber, daoAddress, Game, controller, vaultCurrency, uScale, gasFeeLiq]
  ) as Promise<VaultMock>;

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

export const deployXChainControllerMock = (deployerSign: Signer, game: string, dao: string): Promise<XChainControllerMock> => {
  return (deployContract(deployerSign, XChainControllerMockArtifact, [game, dao])) as Promise<XChainControllerMock>;
};

export const deployXProvider = (
  deployerSign: Signer, 
  executor: string, 
  handler: string, 
  dao: string, 
  xController: string,
  homeChain: number,
): Promise<XProvider> => {
  return (deployContract(deployerSign, XProviderArtifact, [executor, handler, dao, xController, homeChain])) as Promise<XProvider>;
};

export const deployIGoverned = (deployerSign: Signer, daoAddress: string, guardianAddress: string): Promise<IGoverned> => {
    return (deployContract(deployerSign, IGovernedArtifact, [daoAddress, guardianAddress])) as Promise<IGoverned>;
};

export const deployDerbyToken = (deployerSign: Signer, name: string, symbol: string, totalDerbySupply: BigNumber): Promise<DerbyToken> => {
    return (deployContract(deployerSign, DerbyTokenArtifact, [name, symbol, totalDerbySupply])) as Promise<DerbyToken>;
};

export const deployGame = (deployerSign: Signer, DerbyTokenAddress: string, routerAddress: string, governedAddress: string, controllerAddress: string): Promise<Game> => {
    return (deployContract(deployerSign, GameArtifact, [DerbyTokenAddress, routerAddress, governedAddress, controllerAddress])) as Promise<Game>;
};

export const deployGameMock = (deployerSign: Signer, name: string, symbol: string, DerbyTokenAddress: string, routerAddress: string, governedAddress: string, controllerAddress: string): Promise<GameMock> => {
  return (deployContract(deployerSign, GameMockArtifact, [name, symbol, DerbyTokenAddress, routerAddress, governedAddress, controllerAddress])) as Promise<GameMock>;
};

export const deployConnextXProviderMock = (deployerSign: Signer, executorAddress: string, daoAddress: string, connextAddress: string): Promise<ConnextXProviderMock> => {
  return (deployContract(deployerSign, ConnextXProviderMockArtifact, [executorAddress, daoAddress, connextAddress])) as Promise<ConnextXProviderMock>;
};

export const deployConnextExecutorMock = (deployerSign: Signer, handlerAddress: string): Promise<ConnextExecutorMock> => {
  return (deployContract(deployerSign, ConnextExecutorMockArtifact, [handlerAddress])) as Promise<ConnextExecutorMock>;
}

export const deployConnextHandlerMock = (deployerSign: Signer, daoAddress: string): Promise<ConnextHandlerMock> => {
  return (deployContract(deployerSign, ConnextHandlerMockArtifact, [daoAddress])) as Promise<ConnextHandlerMock>;
}

export const deployXReceiveMock = (deployerSign: Signer, ConnextXProviderAddress: string): Promise<XReceiveMock> => {
  return (deployContract(deployerSign, XReceiveMockArtifact, [ConnextXProviderAddress])) as Promise<XReceiveMock>;
}

export const deployXSendMock = (deployerSign: Signer, ConnextXProviderAddress: string): Promise<XSendMock> => {
  return (deployContract(deployerSign, XSendMockArtifact, [ConnextXProviderAddress])) as Promise<XSendMock>;
}


