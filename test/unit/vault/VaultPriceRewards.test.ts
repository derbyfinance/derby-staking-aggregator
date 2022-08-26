/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { erc20, formatUnits, formatUSDC, getUSDCSigner, getWhale, parseEther, parseUnits, parseUSDC } from '../../helpers/helpers';
import type { Controller, VaultMock } from '../../../typechain-types';
import { deployController, deployVaultMock } from '../../helpers/deploy';
import { usdc, dai, compToken, CompWhale, compound_dai_01, aave_usdt_01, yearn_usdc_01, aave_usdc_01, compound_usdc_01, compoundUSDC, compoundDAI, aaveUSDC, yearnUSDC, aaveUSDT } from "../../helpers/addresses";
import { initController, rebalanceETF } from "../../helpers/vaultHelpers";
import AllMockProviders from "../../helpers/allMockProvidersClass";
import { ethers, network } from "hardhat";
import { vaultInfo } from "../../helpers/vaultHelpers";
import { Result } from "ethers/lib/utils";
import { ProtocolVault } from "@testhelp/protocolVaultClass";


const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing Vault Store Price and Rewards, unit test", async () => {
  let vault: VaultMock, controller: Controller, dao: Signer, user: Signer, USDCSigner: Signer, compSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, IDAI: Contract, IComp: Contract;

  const protocols = new Map<string, ProtocolVault>()
  .set('compound_usdc_01', compound_usdc_01)
  .set('aave_usdc_01', aave_usdc_01)
  .set('yearn_usdc_01', yearn_usdc_01)
  .set('compound_dai_01', compound_dai_01)
  .set('aave_usdt_01', aave_usdt_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;
  const compoundDAIVault = protocols.get('compound_dai_01')!;
  const aaveUSDTVault = protocols.get('aave_usdt_01')!;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, compSigner, IUSDc, IDAI, IComp, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      getWhale(CompWhale),
      erc20(usdc),
      erc20(dai),
      erc20(compToken),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    await Promise.all([
      initController(controller, [userAddr, vault.address]),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(10)),
      IUSDc.connect(user).approve(vault.address, amountUSDC.mul(10)),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, AllMockProviders);
    }
  });


  it.only("Should store historical prices2", async function() {
    const {yearnProvider, compoundProvider, aaveProvider} = AllMockProviders;
    
    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(1000), 
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(2000), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(3000), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(4000), 
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(5000), 
    ]);

    await vault.setTotalAllocatedTokensTest(10_000);
    await vault.connect(user).depositETF(amountUSDC);
    
    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await rebalanceETF(vault);

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(1100), 
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(2200), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(3300), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(4400), 
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(5500), 
    ]);

    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await rebalanceETF(vault);

    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await rebalanceETF(vault);

  });
});


// await Promise.all([
//   compoundVault.setDeltaAllocation(vault, user, 20),
//   aaveVault.setDeltaAllocation(vault, user, 20),
//   yearnVault.setDeltaAllocation(vault, user, 20),
//   compoundDAIVault.setDeltaAllocation(vault, user, 20),
//   aaveUSDTVault.setDeltaAllocation(vault, user, 20),
// ]);
