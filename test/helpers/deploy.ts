import { ethers, waffle } from 'hardhat';
const { deployContract } = waffle;
import { Signer, BigNumber } from 'ethers';
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
  MainVaultMock,
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
  LZEndpointMock,
  LZXProviderMock,
} from '@typechain';

import YearnProviderArtifact from '@artifacts/Providers/YearnProvider.sol/YearnProvider.json';
import BetaProviderArtifact from '@artifacts/Providers/BetaProvider.sol/BetaProvider.json';
import IdleProviderArtifact from '@artifacts/Providers/IdleProvider.sol/IdleProvider.json';
import HomoraProviderArtifact from '@artifacts/Providers/HomoraProvider.sol/HomoraProvider.json';
import TruefiProviderArtifact from '@artifacts/Providers/TruefiProvider.sol/TruefiProvider.json';
import CompoundProviderArtifact from '@artifacts/Providers/CompoundProvider.sol/CompoundProvider.json';
import CompoundProviderMockArtifact from '@artifacts/Mocks/CompoundProviderMock.sol/CompoundProviderMock.json';
import AaveProviderArtifact from '@artifacts/Providers/AaveProvider.sol/AaveProvider.json';
import VaultArtifact from '@artifacts/Vault.sol/Vault.json';
import TokenTimelockArtifact from '@artifacts/TokenTimelock.sol/TokenTimelock.json';
// import MainVaultArtifactMock from '@artifacts/Mocks/MainVaultMock.sol/MainVaultMock.json';
import IGovernedArtifact from '@artifacts/Interfaces/IGoverned.sol/IGoverned.json';
import DerbyTokenArtifact from '@artifacts/DerbyToken.sol/DerbyToken.json';
import GameArtifact from '@artifacts/Game.sol/Game.json';
import GameMockArtifact from '@artifacts/Mocks/GameMock.sol/GameMock.json';
import ControllerArtifact from '@artifacts/Controller.sol/Controller.json';
import SwapArtifact from '@artifacts/libraries/Swap.sol/Swap.json';
import XChainControllerArtifact from '@artifacts/XChainController.sol/XChainController.json';
import XChainControllerMockArtifact from '@artifacts/Mocks/XChainControllerMock.sol/XChainControllerMock.json';
import XProviderArtifact from '@artifacts/XProvider.sol/XProvider.json';
import ConnextXProviderMockArtifact from '@artifacts/Mocks/Connext/ConnextXProviderMock.sol/ConnextXProviderMock.json';
import ConnextExecutorMockArtifact from '@artifacts/Mocks/Connext/ConnextExecutorMock.sol/ConnextExecutorMock.json';
import ConnextHandlerMockArtifact from '@artifacts/Mocks/Connext/ConnextHandlerMock.sol/ConnextHandlerMock.json';
import LZEndpointMockArtifact from '@artifacts/Mocks/LayerZero/LZEndpointMock.sol/LZEndpointMock.json';
import LZXProviderMockArtifact from '@artifacts/Mocks/LayerZero/LZXProviderMock.sol/LZXProviderMock.json';
import XReceiveMockArtifact from '@artifacts/Mocks/XReceiveMock.sol/XReceiveMock.json';
import XSendMockArtifact from '@artifacts/Mocks/XSendMock.sol/XSendMock.json';
import { ChainlinkGasPrice, curve3Pool, uniswapQuoter, uniswapRouter } from './addresses';

export const deployTokenTimeLock = (
  deployerSign: Signer,
  tokenAddr: string,
): Promise<TokenTimelock> => {
  return deployContract(deployerSign, TokenTimelockArtifact, [tokenAddr]) as Promise<TokenTimelock>;
};

export const deployBetaProvider = (
  deployerSign: Signer,
  controller: string,
): Promise<BetaProvider> => {
  return deployContract(deployerSign, BetaProviderArtifact, [controller]) as Promise<BetaProvider>;
};

export const deployIdleProvider = (
  deployerSign: Signer,
  controller: string,
): Promise<IdleProvider> => {
  return deployContract(deployerSign, IdleProviderArtifact, [controller]) as Promise<IdleProvider>;
};

export const deployHomoraProvider = (
  deployerSign: Signer,
  controller: string,
): Promise<HomoraProvider> => {
  return deployContract(deployerSign, HomoraProviderArtifact, [
    controller,
  ]) as Promise<HomoraProvider>;
};

export const deployYearnProvider = (
  deployerSign: Signer,
  controller: string,
): Promise<YearnProvider> => {
  return deployContract(deployerSign, YearnProviderArtifact, [
    controller,
  ]) as Promise<YearnProvider>;
};

export const deployTruefiProvider = (
  deployerSign: Signer,
  controller: string,
): Promise<TruefiProvider> => {
  return deployContract(deployerSign, TruefiProviderArtifact, [
    controller,
  ]) as Promise<TruefiProvider>;
};

export const deployCompoundProvider = (
  deployerSign: Signer,
  controller: string,
  comptroller: string,
): Promise<CompoundProvider> => {
  return deployContract(deployerSign, CompoundProviderArtifact, [
    controller,
    comptroller,
  ]) as Promise<CompoundProvider>;
};

export const deployCompoundProviderMock = (
  deployerSign: Signer,
  controller: string,
  comptroller: string,
): Promise<CompoundProviderMock> => {
  return deployContract(deployerSign, CompoundProviderMockArtifact, [
    controller,
    comptroller,
  ]) as Promise<CompoundProviderMock>;
};

export const deployAaveProvider = (
  deployerSign: Signer,
  controller: string,
): Promise<AaveProvider> => {
  return deployContract(deployerSign, AaveProviderArtifact, [controller]) as Promise<AaveProvider>;
};

export const deployVault = (
  deployerSign: Signer,
  name: string,
  symbol: string,
  decimals: number,
  vaultNumber: number,
  daoAddress: string,
  Game: string,
  controller: string,
  vaultCurrency: string,
  uScale: number,
  gasFeeLiq: number,
) =>
  deployContract(deployerSign, VaultArtifact, [
    name,
    symbol,
    decimals,
    vaultNumber,
    daoAddress,
    Game,
    controller,
    vaultCurrency,
    uScale,
    gasFeeLiq,
  ]) as Promise<Vault>;

export const deployMainVaultMock = async (
  deployerSign: Signer,
  name: string,
  symbol: string,
  decimals: number,
  vaultNumber: number,
  daoAddress: string,
  guardianAddress: string,
  Game: string,
  controller: string,
  vaultCurrency: string,
  uScale: number,
  gasFeeLiq: number,
) => {
  const swapLibrary = await deploySwapLibrary(deployerSign);
  const Vault = await ethers.getContractFactory('MainVaultMock', {
    libraries: {
      Swap: swapLibrary.address,
    },
  });
  return Vault.deploy(
    name,
    symbol,
    decimals,
    vaultNumber,
    daoAddress,
    guardianAddress,
    Game,
    controller,
    vaultCurrency,
    uScale,
    gasFeeLiq,
  ) as Promise<MainVaultMock>;
};

export const deployController = (deployerSign: Signer, daoAddress: string): Promise<Controller> => {
  return deployContract(deployerSign, ControllerArtifact, [
    daoAddress,
    curve3Pool,
    uniswapRouter,
    uniswapQuoter,
    3000,
    ChainlinkGasPrice,
  ]) as Promise<Controller>;
};

export const deploySwapLibrary = (deployerSign: Signer): Promise<any> => {
  return deployContract(deployerSign, SwapArtifact, []) as Promise<any>;
};

export const deployXChainController = (
  deployerSign: Signer,
  game: string,
  dao: string,
  guardian: string,
  homeChain: number,
): Promise<XChainController> => {
  return deployContract(deployerSign, XChainControllerArtifact, [
    game,
    dao,
    guardian,
    homeChain,
  ]) as Promise<XChainController>;
};

export const deployXChainControllerMock = (
  deployerSign: Signer,
  game: string,
  dao: string,
  guardian: string,
  homeChain: number,
): Promise<XChainControllerMock> => {
  return deployContract(deployerSign, XChainControllerMockArtifact, [
    game,
    dao,
    guardian,
    homeChain,
  ]) as Promise<XChainControllerMock>;
};

export const deployXProvider = (
  deployerSign: Signer,
  endpointAddress: string,
  connextHandler: string,
  dao: string,
  game: string,
  xController: string,
  homeChain: number,
): Promise<XProvider> => {
  return deployContract(deployerSign, XProviderArtifact, [
    endpointAddress,
    connextHandler,
    dao,
    game,
    xController,
    homeChain,
  ]) as Promise<XProvider>;
};

export const deployIGoverned = (
  deployerSign: Signer,
  daoAddress: string,
  guardianAddress: string,
): Promise<IGoverned> => {
  return deployContract(deployerSign, IGovernedArtifact, [
    daoAddress,
    guardianAddress,
  ]) as Promise<IGoverned>;
};

export const deployDerbyToken = (
  deployerSign: Signer,
  name: string,
  symbol: string,
  totalDerbySupply: BigNumber,
): Promise<DerbyToken> => {
  return deployContract(deployerSign, DerbyTokenArtifact, [
    name,
    symbol,
    totalDerbySupply,
  ]) as Promise<DerbyToken>;
};

export const deployGame = (
  deployerSign: Signer,
  DerbyTokenAddress: string,
  routerAddress: string,
  daoAddress: string,
  guardianAddress: string,
  controllerAddress: string,
): Promise<Game> => {
  return deployContract(deployerSign, GameArtifact, [
    DerbyTokenAddress,
    routerAddress,
    daoAddress,
    guardianAddress,
    controllerAddress,
  ]) as Promise<Game>;
};

export const deployGameMock = (
  deployerSign: Signer,
  name: string,
  symbol: string,
  DerbyTokenAddress: string,
  routerAddress: string,
  daoAddress: string,
  guardianAddress: string,
  controllerAddress: string,
): Promise<GameMock> => {
  return deployContract(deployerSign, GameMockArtifact, [
    name,
    symbol,
    DerbyTokenAddress,
    routerAddress,
    daoAddress,
    guardianAddress,
    controllerAddress,
  ]) as Promise<GameMock>;
};

export const deployConnextXProviderMock = (
  deployerSign: Signer,
  executorAddress: string,
  daoAddress: string,
  connextAddress: string,
): Promise<ConnextXProviderMock> => {
  return deployContract(deployerSign, ConnextXProviderMockArtifact, [
    executorAddress,
    daoAddress,
    connextAddress,
  ]) as Promise<ConnextXProviderMock>;
};

export const deployConnextExecutorMock = (
  deployerSign: Signer,
  handlerAddress: string,
): Promise<ConnextExecutorMock> => {
  return deployContract(deployerSign, ConnextExecutorMockArtifact, [
    handlerAddress,
  ]) as Promise<ConnextExecutorMock>;
};

export const deployConnextHandlerMock = (
  deployerSign: Signer,
  daoAddress: string,
): Promise<ConnextHandlerMock> => {
  return deployContract(deployerSign, ConnextHandlerMockArtifact, [
    daoAddress,
  ]) as Promise<ConnextHandlerMock>;
};

export const deployLZEndpointMock = (
  deployerSign: Signer,
  chainID: number,
): Promise<LZEndpointMock> => {
  return deployContract(deployerSign, LZEndpointMockArtifact, [chainID]) as Promise<LZEndpointMock>;
};

export const deployLZXProviderMock = (
  deployerSign: Signer,
  endpointAddress: string,
  daoAddress: string,
  connextAddress: string,
): Promise<LZXProviderMock> => {
  return deployContract(deployerSign, LZXProviderMockArtifact, [
    endpointAddress,
    daoAddress,
    connextAddress,
  ]) as Promise<LZXProviderMock>;
};

export const deployXReceiveMock = (
  deployerSign: Signer,
  daoAddress: string,
): Promise<XReceiveMock> => {
  return deployContract(deployerSign, XReceiveMockArtifact, [daoAddress]) as Promise<XReceiveMock>;
};

export const deployXSendMock = (deployerSign: Signer, daoAddress: string): Promise<XSendMock> => {
  return deployContract(deployerSign, XSendMockArtifact, [daoAddress]) as Promise<XSendMock>;
};
