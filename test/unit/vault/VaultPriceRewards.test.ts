/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { erc20, formatUnits, formatUSDC, getUSDCSigner, getWhale, parseEther, parseUnits, parseUSDC } from '../../helpers/helpers';
import type { Controller, DerbyToken, GameMock, VaultMock, XProvider } from '../../../typechain-types';
import { deployController, deployDerbyToken, deployGameMock, deployVaultMock, deployXProvider } from '../../helpers/deploy';
import { usdc, dai, compToken, CompWhale, compound_dai_01, aave_usdt_01, yearn_usdc_01, aave_usdc_01, compound_usdc_01, compoundUSDC, compoundDAI, aaveUSDC, yearnUSDC, aaveUSDT } from "../../helpers/addresses";
import { initController, rebalanceETF } from "../../helpers/vaultHelpers";
import AllMockProviders from "../../helpers/allMockProvidersClass";
import { ethers, network } from "hardhat";
import { vaultInfo } from "../../helpers/vaultHelpers";
import { Result } from "ethers/lib/utils";
import { ProtocolVault } from "@testhelp/protocolVaultClass";


const amount = 100_000;
const homeChain = 10;
const chainIds = [10, 100, 1000, 2000];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther(1E8.toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing Vault Store Price and Rewards, unit test", async () => {
  let vault: VaultMock, controller: Controller, dao: Signer, user: Signer, xProvider: XProvider, USDCSigner: Signer, compSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, IDAI: Contract, IComp: Contract, DerbyToken: DerbyToken, game: GameMock;

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
    DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    game = await deployGameMock(user, nftName, nftSymbol, DerbyToken.address, controller.address, daoAddr, controller.address);
    xProvider = await deployXProvider(dao, controller.address, controller.address, daoAddr, game.address, controller.address, homeChain)

    await Promise.all([
      initController(controller, [userAddr, vault.address]),
      AllMockProviders.deployAllMockProviders(dao),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(10)),
      IUSDc.connect(user).approve(vault.address, amountUSDC.mul(10)),
    ]);

    await Promise.all([
      vault.setHomeXProviderAddress(xProvider.address),
      vault.setChainIds(homeChain),
      xProvider.setGameChainId(homeChain),
      xProvider.toggleVaultWhitelist(vault.address),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, AllMockProviders);
    }
  });


  it("Should store historical prices2", async function() {
    const {yearnProvider, compoundProvider, aaveProvider} = AllMockProviders;
    
    await vault.setTotalAllocatedTokensTest(10_000);
    await vault.connect(user).depositETF(amountUSDC);

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(1000), 
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(2000), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(3000), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(4000), 
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(5000), 
    ]);

    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await rebalanceETF(vault);

    await vault.sendPriceAndRewardsToGame();

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(1100), 
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(2200), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(3300), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(4400), 
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(5600), 
    ]);

    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await rebalanceETF(vault);

    await vault.sendPriceAndRewardsToGame();

    for (const protocol of protocols.values()) {
      const price = await game.getHistoricalPriceTEST(vaultNumber, homeChain, 0, protocol.number);
      console.log({ price })
    }

  });
});


// await Promise.all([
//   compoundVault.setDeltaAllocation(vault, user, 20),
//   aaveVault.setDeltaAllocation(vault, user, 20),
//   yearnVault.setDeltaAllocation(vault, user, 20),
//   compoundDAIVault.setDeltaAllocation(vault, user, 20),
//   aaveUSDTVault.setDeltaAllocation(vault, user, 20),
// ]);
