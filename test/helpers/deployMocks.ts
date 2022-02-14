/* eslint-disable prettier/prettier */
import { deployMockContract, MockContract } from "ethereum-waffle";
import { Signer } from "ethers";

import YearnProviderArtifact from '../../artifacts/contracts/Providers/YearnProvider.sol/YearnProvider.json';
import CompoundProviderArtifact from '../../artifacts/contracts/Providers/CompoundProvider.sol/CompoundProvider.json';
import AaveProviderArtifact from '../../artifacts/contracts/Providers/AaveProvider.sol/AaveProvider.json';
import RouterArtifact from '../../artifacts/contracts/Router.sol/Router.json';
import erc20ABI from '../../abis/erc20.json';

export const deployYearnProviderMock = (
  deployerSign: Signer, 
  ): Promise<MockContract> => {
  return (deployMockContract(
    deployerSign, 
    YearnProviderArtifact.abi, 
)) as Promise<MockContract>};

export const deployCompoundProviderMock = (
  deployerSign: Signer, 
  ): Promise<MockContract> => {
  return (deployMockContract(
    deployerSign, 
    CompoundProviderArtifact.abi, 
)) as Promise<MockContract>};

export const deployAaveProviderMock = (
  deployerSign: Signer, 
  ): Promise<MockContract> => {
  return (deployMockContract(
    deployerSign, 
    AaveProviderArtifact.abi, 
)) as Promise<MockContract>};

export const deployRouterMock = (
  deployerSign: Signer, 
  ): Promise<MockContract> => {
  return (deployMockContract(
    deployerSign, 
    RouterArtifact.abi, 
)) as Promise<MockContract>};

export const deployERC20Mock = (
  deployerSign: Signer, 
  ): Promise<MockContract> => {
  return (deployMockContract(
    deployerSign, 
    erc20ABI, 
)) as Promise<MockContract>};