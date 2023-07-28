import { MockContract } from '@ethereum-waffle/mock-contract';
import { Signer } from 'ethers';
import { deployCompoundProviderMock, deployYearnProviderMock } from '../deployMocks';

class AllMockProviders {
  yearnProvider!: MockContract;
  compoundProvider!: MockContract;

  async deployAllMockProviders(dao: Signer): Promise<void> {
    [this.yearnProvider, this.compoundProvider] = await Promise.all([
      deployYearnProviderMock(dao),
      deployCompoundProviderMock(dao),
    ]);
  }

  getProviderAddress(name: string) {
    if (name.includes('yearn')) return this.yearnProvider.address;
    if (name.includes('compound')) return this.compoundProvider.address;
    else return 'none';
  }
}

export default new AllMockProviders();
