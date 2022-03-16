/* eslint-disable prettier/prettier */
import { BigNumber } from "ethers";
import { ethers, network, waffle } from "hardhat";
import erc20ABI from '../../abis/erc20.json';
import cTokenABI from '../../abis/cToken.json';
import { Router } from "typechain-types";
import { Result } from "ethers/lib/utils";

const provider = waffle.provider;

const DAIWhale = "0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0";
const USDCWhale = '0x55FE002aefF02F77364de339a1292923A15844B8';

// SIGNERS
export const getDAISigner = async () => {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [DAIWhale],
  });
  return ethers.provider.getSigner(DAIWhale);
}

export const getUSDCSigner = async () => {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [USDCWhale],
  });
  return ethers.provider.getSigner(USDCWhale);
}

export const getWhale = async (address: string) => {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  return ethers.provider.getSigner(address);
}

export const routerAddProtocol = async (
  router: Router, 
  name: string, 
  provider: string, 
  protocolToken: string,
  protocolUnderlying: string,
  govToken: string
) => {
  const tx = await router.addProtocol(name, provider, protocolToken, protocolUnderlying, govToken)
  const receipt = await tx.wait()
  const { protocolNumber } = receipt.events![0].args as Result
  
  return Number(protocolNumber)
}

export const erc20 = async (tokenAddress: string) => {
  return new ethers.Contract(tokenAddress, erc20ABI, provider);
}

export const cToken = async (tokenAddress: string) => {
  return new ethers.Contract(tokenAddress, cTokenABI, provider);
}

// FORMATTING
export const parseEther = (amount: string) => ethers.utils.parseEther(amount)
export const formatEther = (amount: string) => ethers.utils.formatEther(amount)
export const parseUnits = (amount: string, number: number) => ethers.utils.parseUnits(amount, number)
export const formatUnits = (amount: string, number: number) => ethers.utils.formatUnits(amount, number)
export const parseUSDC = (amount: string) => ethers.utils.parseUnits(amount, 6)
export const formatUSDC = (amount: string | BigNumber) => ethers.utils.formatUnits(amount, 6)
