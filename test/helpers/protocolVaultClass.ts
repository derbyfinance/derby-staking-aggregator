/* eslint-disable prettier/prettier */
import { BigNumber, Signer } from "ethers";
import { Result } from "ethers/lib/utils";
import { Controller, ETFVaultMock } from "typechain-types";

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
  };

  async setDeltaAllocation(vault: ETFVaultMock, game: Signer, allocation: number) {
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

  async addProtocolToController(controller: Controller, ETFnumber: number, providerAddr: string) {
    const tx = await controller.addProtocol(
      this.name, 
      ETFnumber, 
      providerAddr, 
      this.protocolToken, 
      this.underlyingToken, 
      this.govToken, 
      (10 ** this.decimals).toString()
    )
    const receipt = await tx.wait()
    const { protocolNumber } = receipt.events![0].args as Result

    this.number = protocolNumber
  }
}