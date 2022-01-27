/* eslint-disable prettier/prettier */
import { BigNumber } from 'ethers';
import type { ETFVaultMock } from '../../typechain-types';

export const getAndLogBalances = async function(vault: ETFVaultMock, protocols: number[][]) {
  const promises = protocols.map((protocol: number[]) => {
    return vault.balanceUnderlying(protocol[0])
  });
  const balances = await Promise.all(promises);

  balances.forEach((balance: BigNumber, i) => {
    console.log(`Balance vault ${protocols[i]}: ${balance}`)
  });

  return balances;
}

export const setDeltaAllocations = async function(vault: ETFVaultMock, protocols: number[][]) {
  const promises = protocols.map((protocol: number[]) => {
    return vault.setDeltaAllocations(protocol[0], protocol[1])
  })

  await Promise.all(promises);
}

export const getAllocations = async function(vault: ETFVaultMock, protocols: number[][]) {
  const promises = protocols.map((protocol: number[]) => {
    return vault.getAllocationTEST(protocol[0])
  })

  return await Promise.all(promises);
}
