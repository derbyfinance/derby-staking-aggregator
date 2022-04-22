/* eslint-disable prettier/prettier */
import { BigNumber, Signer } from 'ethers';
import type { ETFVaultMock, Controller } from '../../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployAaveProvider } from './deploy';
import { comptroller } from "./addresses";
import { Result } from 'ethers/lib/utils';

interface Protocol {
  number: number;
  allocation: number;
  address: string;
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

export const rebalanceETF = async (vaultMock: ETFVaultMock) => {
  const tx = await vaultMock.rebalanceETF();
  const receipt = await tx.wait();
  const  { gasInVaultCurrency }  = receipt.events!.at(-1)!.args as Result;

  return gasInVaultCurrency;
}
