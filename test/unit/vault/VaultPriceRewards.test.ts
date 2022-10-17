import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, getUSDCSigner, parseEther, parseUnits, parseUSDC } from '@testhelp/helpers';
import type { Controller, DerbyToken, GameMock, MainVaultMock, XProvider } from '@typechain';
import { deployController, deployDerbyToken, deployGameMock, deployMainVaultMock, deployXProvider } from '@testhelp/deploy';
import { usdc, compound_dai_01, aave_usdt_01, yearn_usdc_01, aave_usdc_01, compound_usdc_01, compoundUSDC, compoundDAI, aaveUSDC, yearnUSDC, aaveUSDT } from "@testhelp/addresses";
import { initController, rebalanceETF } from "@testhelp/vaultHelpers";
import AllMockProviders from "@testhelp/allMockProvidersClass";
import { vaultInfo } from "@testhelp/vaultHelpers";
import { ProtocolVault } from "@testhelp/protocolVaultClass";


const amount = 1_000_000;
const homeChain = 10;
const chainIds = [10, 100, 1000, 2000];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther(1E8.toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe.skip("Testing Vault Store Price and Rewards, unit test", async () => {
  let vault: MainVaultMock, controller: Controller, dao: Signer, user: Signer, xProvider: XProvider, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, DerbyToken: DerbyToken, game: GameMock;

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

  before(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployMainVaultMock(dao, name, symbol, decimals, vaultNumber, daoAddr, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity);
    DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    game = await deployGameMock(user, nftName, nftSymbol, DerbyToken.address, controller.address, daoAddr, daoAddr, controller.address);
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
      game.connect(dao).setXProvider(xProvider.address),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, AllMockProviders);
    }
  });


  it("Should store historical prices and rewards, rebalance: 1", async function() {
    const {yearnProvider, compoundProvider, aaveProvider} = AllMockProviders;
    
    await vault.setTotalAllocatedTokensTest(parseEther("10000")); // 10k 
    await vault.connect(user).deposit(amountUSDC);

    compoundVault.setPrice(parseUnits("1000", compoundVault.decimals));
    aaveVault.setPrice(parseUnits("2000", aaveVault.decimals));
    yearnVault.setPrice(parseUnits("3000", aaveVault.decimals));
    compoundDAIVault.setPrice(parseUnits("4000", aaveVault.decimals));
    aaveUSDTVault.setPrice(parseUnits("5000", aaveVault.decimals));

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(compoundVault.price), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(aaveVault.price), 
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(yearnVault.price), 
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(compoundDAIVault.price), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(aaveUSDTVault.price), 
    ]);

    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await rebalanceETF(vault);

    await game.upRebalancingPeriod(vaultNumber);
    await vault.sendRewardsToGame();

    for (const protocol of protocols.values()) {
      expect(await vault.getHistoricalPriceTEST(1, protocol.number)).to.be.equal(protocol.price);
      expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 1, protocol.number)).to.be.equal(0);
    }
  });

  it("Should store historical prices and rewards, rebalance: 2", async function() {
    const {yearnProvider, compoundProvider, aaveProvider} = AllMockProviders;
    
    compoundVault.setPrice(parseUnits("1100", compoundVault.decimals)); // 10%
    aaveVault.setPrice(parseUnits("2100", aaveVault.decimals)); // 5%
    yearnVault.setPrice(parseUnits("3030", aaveVault.decimals)); // 1%
    compoundDAIVault.setPrice(parseUnits("4004", aaveVault.decimals)); // 0.1%
    aaveUSDTVault.setPrice(parseUnits("5010", aaveVault.decimals)); // 0.2%

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(compoundVault.price), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(aaveVault.price), 
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(yearnVault.price), 
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(compoundDAIVault.price), 
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(aaveUSDTVault.price), 
    ]);

    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await rebalanceETF(vault);

    await game.upRebalancingPeriod(vaultNumber);
    await vault.sendRewardsToGame();



    for (const protocol of protocols.values()) {
      expect(await vault.getHistoricalPriceTEST(2, protocol.number)).to.be.equal(protocol.price);
    }

    // 1_000_000 - 100_000 (liq) * percentage gain
    expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, compoundVault.number)).to.be.equal(899953);
    expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, aaveVault.number)).to.be.equal(449976);
    expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, yearnVault.number)).to.be.equal(89995);
    expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, compoundDAIVault.number)).to.be.equal(8999);
    expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, aaveUSDTVault.number)).to.be.equal(17999);
  });
});
