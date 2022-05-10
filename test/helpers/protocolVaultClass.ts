import { BigNumber, Signer } from "ethers";
import { ETFVaultMock } from "typechain-types";

export interface IProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
}

export class ProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
  number: number = 0;
  allocation: number = 0;

  constructor({name, protocolToken, underlyingToken, govToken, decimals}: IProtocolVault) {
    this.name = name;
    this.protocolToken = protocolToken;
    this.underlyingToken = underlyingToken;
    this.govToken = govToken;
    this.decimals = decimals;
  }

  async setDeltaAllocation(vault: ETFVaultMock, game: Signer, allocation: number): Promise<void> {
    this.allocation = allocation;
    await vault.connect(game).setDeltaAllocations(this.number, allocation)
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
}