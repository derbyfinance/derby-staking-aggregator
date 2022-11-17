import { readFileSync, writeFileSync } from 'fs';
import { general } from './settings';

export interface INetwork {
  network: 'localhost' | 'goerli';
  homechain?: number;
}

export function addAddress(network: string, contractName: string, contractAddress: string) {
  const file = JSON.parse(readFileSync(general.addressfile, 'utf8'));
  file[network!][contractName] = contractAddress;
  writeFileSync(general.addressfile, JSON.stringify(file));
}

export function readAddressFile() {
  return JSON.parse(readFileSync(general.addressfile, 'utf8'));
}
