/* eslint-disable prettier/prettier */
import { BigNumber, Signer } from 'ethers';
import type { ETFVaultMock, Router } from '../../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployAaveProvider } from './deploy';
import { comptroller } from "./addresses";

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

export function setCurrentAllocations(vault: ETFVaultMock, protocols: Protocol[]) {
  return Promise.all(protocols.map((protocol: Protocol) => 
    vault.setCurrentAllocation(protocol.number, protocol.allocation))
)}

export function deployAllProviders(dao: Signer, router: Router) {
  return Promise.all([
    deployYearnProvider(dao, router.address),
    deployCompoundProvider(dao, router.address, comptroller),
    deployAaveProvider(dao, router.address),
  ]);
}
