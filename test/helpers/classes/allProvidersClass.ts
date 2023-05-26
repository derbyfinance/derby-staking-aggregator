import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment } from 'hardhat-deploy/types';

class AllProviders {
  yearnProvider!: Deployment;
  compoundProvider!: Deployment;
  truefiProvider!: Deployment;
  idleProvider!: Deployment;

  async setProviders({ deployments }: HardhatRuntimeEnvironment): Promise<any> {
    [this.yearnProvider, this.compoundProvider, this.truefiProvider, this.idleProvider] =
      await Promise.all([
        deployments.get('YearnProvider'),
        deployments.get('CompoundProvider'),
        deployments.get('TruefiProvider'),
        deployments.get('IdleProvider'),
      ]);
  }

  getProviderAddress(name: string) {
    if (name.includes('yearn')) return this.yearnProvider.address;
    if (name.includes('compound')) return this.compoundProvider.address;
    if (name.includes('truefi')) return this.truefiProvider.address;
    if (name.includes('idle')) return this.idleProvider.address;
    else return 'none';
  }
}

export default new AllProviders();
