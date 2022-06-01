/* eslint-disable prettier/prettier */
import { MockContract } from "ethereum-waffle";
import { Signer } from "ethers";
import { deployAaveProviderMock, deployCompoundProviderMock, deployYearnProviderMock } from "./deployMocks";

class AllMockProviders {
  yearnProviderMock!: MockContract;
  compoundProviderMock!: MockContract;
  aaveProviderMock!: MockContract;

  async deployAllMockProviders(dao: Signer): Promise<void> {
    [
      this.yearnProviderMock, 
      this.compoundProviderMock, 
      this.aaveProviderMock, 
    ] = await Promise.all([
      deployYearnProviderMock(dao),
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
    ]);
  }

  getProviderAddress(name: string) {
    if (name.includes('yearn')) return this.yearnProviderMock.address;
    if (name.includes('compound')) return this.compoundProviderMock.address;
    if (name.includes('aave')) return this.aaveProviderMock.address;
    else return 'none';
  }
}

export default new AllMockProviders();