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
  MainVault,
  MainVaultMock,
  CompoundProviderMock,
  GameMock,
  TokenTimelock,
  XChainController,
  XProvider,
  XChainControllerMock,
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
import MainVaultArtifact from '@artifacts/MainVault.sol/MainVault.json';
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
import { ChainlinkGasPrice, curve3Pool, uniswapQuoter, uniswapRouter } from './addresses';

export const deployTokenTimeLock = (
  deployerSign: Signer,
  tokenAddr: string,
): Promise<TokenTimelock> => {
  return deployContract(deployerSign, TokenTimelockArtifact, [tokenAddr]) as Promise<TokenTimelock>;
};

export const deployBetaProvider = (deployerSign: Signer): Promise<BetaProvider> => {
  return deployContract(deployerSign, BetaProviderArtifact, []) as Promise<BetaProvider>;
};

export const deployIdleProvider = (deployerSign: Signer): Promise<IdleProvider> => {
  return deployContract(deployerSign, IdleProviderArtifact, []) as Promise<IdleProvider>;
};

export const deployHomoraProvider = (deployerSign: Signer): Promise<HomoraProvider> => {
  return deployContract(deployerSign, HomoraProviderArtifact, []) as Promise<HomoraProvider>;
};

export const deployYearnProvider = (deployerSign: Signer): Promise<YearnProvider> => {
  return deployContract(deployerSign, YearnProviderArtifact, []) as Promise<YearnProvider>;
};

export const deployTruefiProvider = (deployerSign: Signer): Promise<TruefiProvider> => {
  return deployContract(deployerSign, TruefiProviderArtifact, []) as Promise<TruefiProvider>;
};

export const deployCompoundProvider = (
  deployerSign: Signer,
  comptroller: string,
): Promise<CompoundProvider> => {
  return deployContract(deployerSign, CompoundProviderArtifact, [
    comptroller,
  ]) as Promise<CompoundProvider>;
};

export const deployCompoundProviderMock = (
  deployerSign: Signer,
  comptroller: string,
): Promise<CompoundProviderMock> => {
  return deployContract(deployerSign, CompoundProviderMockArtifact, [
    comptroller,
  ]) as Promise<CompoundProviderMock>;
};

export const deployAaveProvider = (deployerSign: Signer): Promise<AaveProvider> => {
  return deployContract(deployerSign, AaveProviderArtifact, []) as Promise<AaveProvider>;
};

export const deployMainVault = async (
  deployerSign: Signer,
  swapLibrary: string,
  daoAddress: string,
  gameAddress: string,
  controller: string,
  { name, symbol, decimals, vaultNumber, vaultCurrency, uScale, gasFeeLiq }: any,
) => {
  const Vault = await ethers.getContractFactory('MainVault', {
    libraries: {
      Swap: swapLibrary,
    },
  });
  return await Vault.deploy(
    name,
    symbol,
    decimals,
    vaultNumber,
    daoAddress,
    gameAddress,
    controller,
    vaultCurrency,
    uScale,
    gasFeeLiq,
  );
};

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
  const vault = (await Vault.deploy(
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
  )) as MainVaultMock;
  await vault.setGuardian(guardianAddress);

  return vault;
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
  originDomain: number,
  source: string,
  connextHandler: string,
  dao: string,
  game: string,
  xController: string,
  homeChain: number,
): Promise<XProvider> => {
  return deployContract(deployerSign, XProviderArtifact, [
    endpointAddress,
    originDomain,
    source,
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
  name: string,
  symbol: string,
  DerbyTokenAddress: string,
  daoAddress: string,
  guardianAddress: string,
  controllerAddress: string,
): Promise<Game> => {
  return deployContract(deployerSign, GameArtifact, [
    name,
    symbol,
    DerbyTokenAddress,
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
  daoAddress: string,
  guardianAddress: string,
  controllerAddress: string,
): Promise<GameMock> => {
  return deployContract(deployerSign, GameMockArtifact, [
    name,
    symbol,
    DerbyTokenAddress,
    daoAddress,
    guardianAddress,
    controllerAddress,
  ]) as Promise<GameMock>;
};
