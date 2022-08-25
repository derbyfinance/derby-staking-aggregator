/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { erc20, formatUnits, formatUSDC, getUSDCSigner, getWhale, parseEther, parseUnits, parseUSDC } from '../../helpers/helpers';
import type { Controller, VaultMock } from '../../../typechain-types';
import { deployController, deployVaultMock } from '../../helpers/deploy';
import { usdc, dai, compToken, CompWhale, compound_dai_01, aave_usdt_01, yearn_usdc_01, aave_usdc_01, compound_usdc_01 } from "../../helpers/addresses";
import { initController, rebalanceETF } from "../../helpers/vaultHelpers";
import allProviders  from "../../helpers/allProvidersClass";
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
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(10)),
      IUSDc.connect(user).approve(vault.address, amountUSDC.mul(10)),
    ]);

    await controller.setClaimable(allProviders.compoundProvider.address, true);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, allProviders);
      await protocol.resetAllocation(vault);
    }
  });

  it("Should store historical prices", async function() {
    const amount = 1_000_000;
    const amountUSDC = parseUSDC(amount.toString());

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, user, 20),
      aaveVault.setDeltaAllocation(vault, user, 20),
      yearnVault.setDeltaAllocation(vault, user, 20),
      compoundDAIVault.setDeltaAllocation(vault, user, 20),
      aaveUSDTVault.setDeltaAllocation(vault, user, 20),
    ]);

    // Deposit and rebalance with 1m 
    await vault.connect(user).depositETF(amountUSDC);
    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);

    let gasUsed = await rebalanceETF(vault);
    let gasUsedUSDC = formatUSDC(gasUsed)

    let totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    let balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    console.log(`USDC Balance vault: ${balanceVault}`)

    // Check if balanceInProtocol === 
    // currentAllocation / totalAllocated * ( amountDeposited - balanceVault - gasUsed)
    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance = (amount - balanceVault - gasUsedUSDC) * (protocol.allocation / totalAllocatedTokens);

      console.log(`---------------------------`)
      console.log(protocol.name)
      console.log(protocol.number)
      console.log(protocol.allocation)
      console.log({ totalAllocatedTokens })
      console.log({ balanceUnderlying })
      console.log({ expectedBalance })

      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 100);
    };
  });
});
