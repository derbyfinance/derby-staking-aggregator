/* eslint-disable prettier/prettier */
import { BigNumber, Signer } from 'ethers';
import type { ETFVaultMock, Controller } from '../../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployAaveProvider } from './deploy';
import { comptroller, dai, usdc, usdt } from "./addresses";
import { Result } from 'ethers/lib/utils';
import { ProtocolVault } from './protocolVaultClass';

interface Protocol {
  number: number;
  allocation: number;
  address: string;
}

export const vaultInfo = {
  name: 'DerbyUSDC',
  symbol: 'cUSDC',
  ETFname: 'USDC_med_risk',
  ETFnumber: 0,
  decimals: 6,
  uScale: 1E6,
  liquidityPerc: 10,
  gasFeeLiquidity: 10_000 * 1E6,
}

export async function getAndLogBalances(vault: ETFVaultMock, protocols: Protocol[]) {
  const promises = protocols.map((protocol: Protocol) => {
    return vault.balanceUnderlying(protocol.number)
  });
  const balances = await Promise.all(promises);

  balances.forEach((balance: BigNumber, i) => {
    console.log(`Balance vault ${protocols[i].number}: ${balance.div(1E6)}`)
  });

  return balances;
}

export function setDeltaAllocations(signer: Signer, vault: ETFVaultMock, protocols: Protocol[]) {
  return Promise.all(protocols.map((protocol: Protocol) => 
    vault.connect(signer).setDeltaAllocations(protocol.number, protocol.allocation))
)}

export function getAllocations(vault: ETFVaultMock, protocols: Protocol[]) {
  return Promise.all(protocols.map((protocol: Protocol) =>
    vault.getAllocationTEST(protocol.number))
)}

export function getDeltaAllocations(vault: ETFVaultMock, protocols: Protocol[]) {
  return Promise.all(protocols.map((protocol: Protocol) =>
    vault.getDeltaAllocationTEST(protocol.number))
)}

export function setCurrentAllocations(vault: ETFVaultMock, protocols: Protocol[]) {
  return Promise.all(protocols.map((protocol: Protocol) => 
    vault.setCurrentAllocation(protocol.number, protocol.allocation))
)}

export function deployAllProviders(dao: Signer, controller: Controller) {
  return Promise.all([
    deployYearnProvider(dao, controller.address),
    deployCompoundProvider(dao, controller.address, comptroller),
    deployAaveProvider(dao, controller.address),
  ]);
}

export function initController(controller: Controller, addVaultAddresses: string[]) {
  const addVaultPromise = Promise.all(addVaultAddresses.map(address => controller.addVault(address)));
  return Promise.all([
    addVaultPromise,
    controller.addCurveIndex(dai, 0),
    controller.addCurveIndex(usdc, 1),
    controller.addCurveIndex(usdt, 2),
  ]);
}

export async function addAllProtocolsToController(
  protocolMap: Map<string, ProtocolVault>, 
  controller: Controller, 
  ETFnumber: number, 
  allProviders: any
  ) {
  for (const protocol of protocolMap.values()) {
    await protocol.addProtocolToController(
      controller,
      ETFnumber,
      allProviders
    );  
  };
}

export const rebalanceETF = async (vaultMock: ETFVaultMock) => {
  const tx = await vaultMock.rebalanceETF();
  const receipt = await tx.wait();
  const  { gasInVaultCurrency }  = receipt.events!.at(-1)!.args as Result;

  return gasInVaultCurrency;
}
