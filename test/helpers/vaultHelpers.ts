/* eslint-disable prettier/prettier */
import { BigNumber, Signer } from 'ethers';
import type { ETFVaultMock, Router } from '../../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployAaveProvider } from './deploy';
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc} from "./addresses";

interface Protocol {
  number: number;
  allocation: number;
  address: string;
}

export async function getAndLogBalances(vault: ETFVaultMock, protocols: Protocol[]) {
  const promises = protocols.map((protocol: Protocol) => {
    return vault.balanceUnderlying(protocol.address)
  });
  const balances = await Promise.all(promises);

  balances.forEach((balance: BigNumber, i) => {
    console.log(`Balance vault ${protocols[i]}: ${balance}`)
  });

  return balances;
}

export async function setDeltaAllocations(vault: ETFVaultMock, protocols: Protocol[]) {
  return protocols.map((protocol: Protocol) => 
    vault.setDeltaAllocations(protocol.number, protocol.allocation))
}

export function getAllocations(vault: ETFVaultMock, protocols: Protocol[]) {
  return protocols.map((protocol: Protocol) =>
    vault.getAllocationTEST(protocol.address))
}

export async function setCurrentAllocations(vault: ETFVaultMock, protocols: Protocol[]) {
  return protocols.map((protocol: Protocol) => 
    vault.setCurrentAllocation(protocol.address, protocol.allocation))
}

export function deployAllProviders(dao: Signer, router: Router, protocols: Protocol[]) {
  return Promise.all([
    deployYearnProvider(dao, yusdc, usdc, router.address),
    deployCompoundProvider(dao, cusdc, usdc, router.address),
    deployAaveProvider(dao, ausdc, router.address),
  ]);
}

export function addProtocolsToRouter(
  ETFNumber: number, 
  router: Router, 
  vault: string, 
  protocols: Protocol[],
  providers: any[]
  ) {
  return protocols.map((protocol, i) => router.addProtocol(ETFNumber, protocol.number, providers[i].address, vault))
}
