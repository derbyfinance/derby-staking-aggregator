import { Signer } from 'ethers';
import { comptroller } from './addresses';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment } from 'hardhat-deploy/types';

class AllProviders {
  yearnProvider!: Deployment;
  compoundProvider!: Deployment;
  aaveProvider!: Deployment;
  // truefiProvider!: TruefiProvider;
  // homoraProvider!: HomoraProvider;
  // idleProvider!: IdleProvider;
  // betaProvider!: BetaProvider;

  async setProviders(hre: HardhatRuntimeEnvironment): Promise<any> {
    const { deployments } = hre;

    [this.yearnProvider, this.compoundProvider, this.aaveProvider] = await Promise.all([
      deployments.get('YearnProvider'),
      deployments.get('CompoundProvider'),
      deployments.get('AaveProvider'),
    ]);
  }

  getProviderAddress(name: string) {
    if (name.includes('yearn')) return this.yearnProvider.address;
    if (name.includes('compound')) return this.compoundProvider.address;
    if (name.includes('aave')) return this.aaveProvider.address;
    // if (name.includes('truefi')) return this.truefiProvider.address;
    // if (name.includes('homora')) return this.homoraProvider.address;
    // if (name.includes('beta')) return this.betaProvider.address;
    // if (name.includes('idle')) return this.idleProvider.address;
    else return 'none';
  }
}

export default new AllProviders();
