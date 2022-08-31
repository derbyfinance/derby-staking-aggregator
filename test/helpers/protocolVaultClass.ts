/* eslint-disable prettier/prettier */
import { BigNumber, Signer } from "ethers";
import { Result } from "ethers/lib/utils";
import { Controller, GameMock, VaultMock } from "typechain-types";
import { parseEther } from "./helpers";

export interface IProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
  chainId: number;
}

export class ProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
  chainId: number;
  number: number = 0;
  allocation: number = 0;
  expectedBalance: number = 0;
  price: BigNumber = parseEther('0');
  scale: number;

  constructor({name, protocolToken, underlyingToken, govToken, decimals, chainId}: IProtocolVault) {
    this.name = name;
    this.protocolToken = protocolToken;
    this.underlyingToken = underlyingToken;
    this.govToken = govToken;
    this.decimals = decimals;
    this.chainId = chainId;
    this.scale = 10 ** decimals;
  };

  setExpectedBalance(balance: number) {
    this.expectedBalance = balance;
    return this;
  }

  setPrice(price: BigNumber) {
    this.price = price;
  }

  async setDeltaAllocation(vault: VaultMock, game: Signer, allocation: number): Promise<void> {
    this.allocation += allocation;
    await vault.connect(game).setDeltaAllocations(this.number, allocation);
  };

  async setDeltaAllocationsWithGame(game: GameMock, vaultAddr:string, allocation: number): Promise<void> {
    this.allocation += allocation;
    await game.setDeltaAllocations(vaultAddr, this.number, allocation);
  };

  async setCurrentAllocation(vault: VaultMock, allocation: number): Promise<void> {
    this.allocation = allocation;
    await vault.setCurrentAllocation(this.number, allocation);
  };

  async getDeltaAllocationTEST(vault: VaultMock): Promise<number> {
    const allocation = await vault.getDeltaAllocationTEST(this.number);
    return allocation.toNumber();
  };

  async getAllocation(vault: VaultMock): Promise<BigNumber> {
    return await vault.getAllocationTEST(this.number);
  };

  async balanceUnderlying(vault: VaultMock): Promise<BigNumber> {
    return await vault.balanceUnderlying(this.number);
  };

  async calcShares(vault: VaultMock, amount: BigNumber): Promise<BigNumber> {
    return await vault.calcShares(this.number, amount);
  };

  async balanceShares(vault: VaultMock, address: string): Promise<BigNumber> {
    return await vault.balanceSharesTEST(this.number, address);
  };

  async resetAllocation(vault: VaultMock) {
    this.allocation = 0;
    await vault.resetDeltaAllocations(this.number);
  }

  async addProtocolToController(controller: Controller, ETFnumber: number, allProviders: any) {
    const tx = await controller.addProtocol(
      this.name, 
      ETFnumber, 
      allProviders.getProviderAddress(this.name), 
      this.protocolToken, 
      this.underlyingToken, 
      this.govToken, 
      (10 ** this.decimals).toString()
    )
    const receipt = await tx.wait();
    const { protocolNumber } = receipt.events![0].args as Result;

    this.number = protocolNumber
  }
}