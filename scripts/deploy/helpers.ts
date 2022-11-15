import { readFileSync, writeFileSync } from 'fs';
import { general } from './settings';

export interface INetwork {
  network: 'localhost';
}
export function addAddress(network: string, contractName: string, contractAddress: string) {
  const file = JSON.parse(readFileSync(general.addressfile, 'utf8'));
  file[network!][contractName] = contractAddress;
  writeFileSync(general.addressfile, JSON.stringify(file));
}
