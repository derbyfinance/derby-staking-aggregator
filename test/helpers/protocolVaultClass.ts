/* eslint-disable prettier/prettier */
import { BigNumber, Signer } from "ethers";
import { ETFVaultMock } from "typechain-types";

export interface IProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
  underlyingDecimals: number;
}

export class ProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
  underlyingDecimals: number;
  number: number = 0;
  allocation: number = 0;

  constructor({name, protocolToken, underlyingToken, govToken, decimals, underlyingDecimals}: IProtocolVault) {
    this.name = name;
    this.protocolToken = protocolToken;
    this.underlyingToken = underlyingToken;
    this.govToken = govToken;
    this.decimals = decimals;
    this.underlyingDecimals = underlyingDecimals;
  };

  async setDeltaAllocation(vault: ETFVaultMock, game: Signer, allocation: number): Promise<void> {
    this.allocation = allocation;
    await vault.connect(game).setDeltaAllocations(this.number, allocation);
  };

  async getDeltaAllocationTEST(vault: ETFVaultMock): Promise<BigNumber> {
    return await vault.getDeltaAllocationTEST(this.number);
  };

  async getAllocation(vault: ETFVaultMock): Promise<BigNumber> {
    return await vault.getAllocationTEST(this.number);
  };

  async balanceUnderlying(vault: ETFVaultMock): Promise<BigNumber> {
    return await vault.balanceUnderlying(this.number);
  };

  async calcShares(vault: ETFVaultMock, amount: BigNumber): Promise<BigNumber> {
    return await vault.calcShares(this.number, amount);
  };

  async balanceShares(vault: ETFVaultMock, address: string): Promise<BigNumber> {
    return await vault.balanceSharesTEST(this.number, address);
  };
}