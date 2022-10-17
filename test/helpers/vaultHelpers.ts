import { BigNumber, Signer } from 'ethers';
import type { MainVaultMock, Controller } from '@typechain';
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
  vaultNumber: 0,
  decimals: 6,
  uScale: 1E6,
  liquidityPerc: 10,
  gasFeeLiquidity: 10_000 * 1E6,
}

export async function getAndLogBalances(vault: MainVaultMock, protocols: Protocol[]) {
  const promises = protocols.map((protocol: Protocol) => {
    return vault.balanceUnderlying(protocol.number)
  });
  const balances = await Promise.all(promises);

  balances.forEach((balance: BigNumber, i) => {
    console.log(`Balance vault ${protocols[i].number}: ${balance.div(1E6)}`)
  });

  return balances;
}

export function setDeltaAllocations(signer: Signer, vault: MainVaultMock, protocols: Protocol[]) {
  return Promise.all(protocols.map((protocol: Protocol) => 
    vault.connect(signer).setDeltaAllocations(protocol.number, protocol.allocation))
)}

export function getAllocations(vault: MainVaultMock, protocols: Protocol[]) {
  return Promise.all(protocols.map((protocol: Protocol) =>
    vault.getAllocationTEST(protocol.number))
)}

export function getDeltaAllocations(vault: MainVaultMock, protocols: Protocol[]) {
  return Promise.all(protocols.map((protocol: Protocol) =>
    vault.getDeltaAllocationTEST(protocol.number))
)}

export function setCurrentAllocations(vault: MainVaultMock, protocols: Protocol[]) {
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
  vaultNumber: number, 
  allProviders: any
  ) {
  for (const protocol of protocolMap.values()) {
    await protocol.addProtocolToController(
      controller,
      vaultNumber,
      allProviders
    );  
  };
}

export const rebalanceETF = async (MainVaultMock: MainVaultMock) => {
  const tx = await MainVaultMock.rebalanceETF();
  const receipt = await tx.wait();
  const  { gasInVaultCurrency }  = receipt.events!.at(-1)!.args as Result;

  return gasInVaultCurrency;
}
