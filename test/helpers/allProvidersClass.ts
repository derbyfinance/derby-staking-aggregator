import { Signer } from 'ethers';
import {
  AaveProvider,
  BetaProvider,
  CompoundProvider,
  Controller,
  HomoraProvider,
  IdleProvider,
  TruefiProvider,
  YearnProvider,
} from '@typechain';
import { comptroller } from './addresses';
import {
  deployAaveProvider,
  deployBetaProvider,
  deployCompoundProvider,
  deployHomoraProvider,
  deployIdleProvider,
  deployTruefiProvider,
  deployYearnProvider,
} from './deploy';

class AllProviders {
  yearnProvider!: YearnProvider;
  compoundProvider!: CompoundProvider;
  aaveProvider!: AaveProvider;
  truefiProvider!: TruefiProvider;
  homoraProvider!: HomoraProvider;
  idleProvider!: IdleProvider;
  betaProvider!: BetaProvider;

  async deployAllProviders(dao: Signer, controller: Controller): Promise<void> {
    [
      this.yearnProvider,
      this.compoundProvider,
      this.aaveProvider,
      this.truefiProvider,
      this.homoraProvider,
      this.idleProvider,
      this.betaProvider,
    ] = await Promise.all([
      deployYearnProvider(dao, controller.address),
      deployCompoundProvider(dao, controller.address, comptroller),
      deployAaveProvider(dao, controller.address),
      deployTruefiProvider(dao, controller.address),
      deployHomoraProvider(dao, controller.address),
      deployIdleProvider(dao, controller.address),
      deployBetaProvider(dao, controller.address),
    ]);
  }

  getProviderAddress(name: string) {
    if (name.includes('yearn')) return this.yearnProvider.address;
    if (name.includes('compound')) return this.compoundProvider.address;
    if (name.includes('aave')) return this.aaveProvider.address;
    if (name.includes('truefi')) return this.truefiProvider.address;
    if (name.includes('homora')) return this.homoraProvider.address;
    if (name.includes('beta')) return this.betaProvider.address;
    if (name.includes('idle')) return this.idleProvider.address;
    else return 'none';
  }
}

export default new AllProviders();
