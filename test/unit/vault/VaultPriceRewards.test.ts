import { deployments, ethers, run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import {
  erc20,
  getUSDCSigner,
  parseEther,
  parseUnits,
  parseUSDC,
  transferAndApproveUSDC,
} from '@testhelp/helpers';
import type {
  Controller,
  DerbyToken,
  GameMock,
  MainVaultMock,
  XChainControllerMock,
  XProvider,
} from '@typechain';
import {
  deployController,
  deployDerbyToken,
  deployGameMock,
  deployMainVaultMock,
  deployXProvider,
} from '@testhelp/deploy';
import {
  usdc,
  compound_dai_01,
  aave_usdt_01,
  yearn_usdc_01,
  aave_usdc_01,
  compound_usdc_01,
  compoundUSDC,
  compoundDAI,
  aaveUSDC,
  yearnUSDC,
  aaveUSDT,
} from '@testhelp/addresses';
import { initController, rebalanceETF } from '@testhelp/vaultHelpers';
import AllMockProviders from '@testhelp/allMockProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';
import { ProtocolVault } from '@testhelp/protocolVaultClass';
import {
  getAllSigners,
  getContract,
  getXProviders,
  InitEndpoints,
  InitProviders,
} from '@testhelp/deployHelpers';
import allProviders from '@testhelp/allProvidersClass';
import { allProtocols } from '@testhelp/addresses';
import { vaultDeploySettings } from 'deploySettings';

const amount = 1_000_000;
const homeChain = 10;
const chainIds = [10, 100, 1000, 2000];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther((1e8).toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe.skip('Testing Vault Store Price and Rewards, unit test', async () => {
  let vault: MainVaultMock,
    controller: Controller,
    dao: Signer,
    user: Signer,
    xProvider: XProvider,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string,
    DerbyToken: DerbyToken,
    game: GameMock;

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

  const setupContracts = deployments.createFixture(async (hre) => {
    await deployments.fixture([
      'XChainControllerMock',
      'MainVaultMock',
      'XProviderMain',
      'XProviderArbi',
      'XProviderOpti',
    ]);

    const [dao, user, guardian] = await getAllSigners(hre);

    const game = (await getContract('GameMock', hre)) as GameMock;
    const controller = (await getContract('Controller', hre)) as Controller;
    const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
    const xChainController = (await getContract(
      'XChainControllerMock',
      hre,
    )) as XChainControllerMock;
    const vault = (await getContract('MainVaultMock', hre)) as MainVaultMock;

    // await allProviders.setProviders(hre);
    await AllMockProviders.deployAllMockProviders(dao);
    await transferAndApproveUSDC(vault.address, user, 10_000_000 * 1e6);

    const [xProviderMain, xProviderArbi] = await getXProviders(hre, { xController: 100, game: 10 });
    await InitProviders(dao, [xProviderMain, xProviderArbi]);
    await InitEndpoints(hre, [xProviderMain, xProviderArbi]);

    await xProviderMain.connect(dao).toggleVaultWhitelist(vault.address);

    const basketId = await run('game_mint_basket', { vaultnumber: vaultNumber });

    await run('game_init', { provider: xProviderMain.address });
    await run('vault_init');
    await run('controller_init');
    await run('xcontroller_init');

    await run('game_set_home_vault', { vault: vault.address });
    await run('xcontroller_set_homexprovider', { address: xProviderArbi.address });

    await run('controller_add_vault', { vault: vault.address });
    await run('vault_set_homexprovider', { address: xProviderMain.address });

    // add all protocol vaults to controller
    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(
        controller,
        dao,
        vaultDeploySettings.vaultNumber,
        AllMockProviders,
      );
    }

    return { vault, controller, game, dao, user, guardian };
  });

  before(async function () {
    const setup = await setupContracts();
    vault = setup.vault;
    controller = setup.controller;
    user = setup.user;
    game = setup.game;
    // [dao, user] = await ethers.getSigners();

    // [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
    //   getUSDCSigner(),
    //   erc20(usdc),
    //   dao.getAddress(),
    //   user.getAddress(),
    // ]);

    // controller = await deployController(dao, daoAddr);
    // vault = await deployMainVaultMock(
    //   dao,
    //   name,
    //   symbol,
    //   decimals,
    //   vaultNumber,
    //   daoAddr,
    //   daoAddr,
    //   userAddr,
    //   controller.address,
    //   usdc,
    //   uScale,
    //   gasFeeLiquidity,
    // );
    // DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    // game = await deployGameMock(
    //   user,
    //   nftName,
    //   nftSymbol,
    //   DerbyToken.address,
    //   daoAddr,
    //   daoAddr,
    //   controller.address,
    // );
    // xProvider = await deployXProvider(
    //   dao,
    //   controller.address,
    //   controller.address,
    //   daoAddr,
    //   game.address,
    //   controller.address,
    //   homeChain,
    // );

    // await Promise.all([
    //   initController(controller, [userAddr, vault.address]),
    //   AllMockProviders.deployAllMockProviders(dao),
    //   IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(10)),
    //   IUSDc.connect(user).approve(vault.address, amountUSDC.mul(10)),
    // ]);

    // await Promise.all([
    //   vault.setHomeXProvider(xProvider.address),
    //   vault.setChainIds(homeChain),
    //   xProvider.setGameChainId(homeChain),
    //   xProvider.toggleVaultWhitelist(vault.address),
    //   game.connect(dao).setXProvider(xProvider.address),
    // ]);

    // for (const protocol of protocols.values()) {
    //   await protocol.addProtocolToController(controller, vaultNumber, AllMockProviders);
    // }
  });

  it.only('Should store historical prices and rewards, rebalance: 1', async function () {
    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;

    await vault.setTotalAllocatedTokensTest(parseEther('10000')); // 10k
    await vault.connect(user).deposit(amountUSDC);

    compoundVault.setPrice(parseUnits('1000', compoundVault.decimals));
    aaveVault.setPrice(parseUnits('2000', aaveVault.decimals));
    yearnVault.setPrice(parseUnits('3000', aaveVault.decimals));
    compoundDAIVault.setPrice(parseUnits('4000', aaveVault.decimals));
    aaveUSDTVault.setPrice(parseUnits('5000', aaveVault.decimals));

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(compoundVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(aaveVault.price),
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(yearnVault.price),
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(compoundDAIVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(aaveUSDTVault.price),
    ]);

    console.log('mocked exchange rates');

    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);

    console.log('before rebalance');
    await rebalanceETF(vault);
    console.log('after rebalance');

    await game.upRebalancingPeriod(vaultNumber);
    await vault.sendRewardsToGame();

    for (const protocol of protocols.values()) {
      expect(await vault.getHistoricalPriceTEST(1, protocol.number)).to.be.equal(protocol.price);
      expect(
        await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 1, protocol.number),
      ).to.be.equal(0);
    }
  });

  it('Should store historical prices and rewards, rebalance: 2', async function () {
    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;

    compoundVault.setPrice(parseUnits('1100', compoundVault.decimals)); // 10%
    aaveVault.setPrice(parseUnits('2100', aaveVault.decimals)); // 5%
    yearnVault.setPrice(parseUnits('3030', aaveVault.decimals)); // 1%
    compoundDAIVault.setPrice(parseUnits('4004', aaveVault.decimals)); // 0.1%
    aaveUSDTVault.setPrice(parseUnits('5010', aaveVault.decimals)); // 0.2%

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
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, compoundVault.number),
    ).to.be.equal(899953);
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, aaveVault.number),
    ).to.be.equal(449976);
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, yearnVault.number),
    ).to.be.equal(89995);
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, compoundDAIVault.number),
    ).to.be.equal(8999);
    expect(
      await game.getRewardsPerLockedTokenTEST(vaultNumber, homeChain, 2, aaveUSDTVault.number),
    ).to.be.equal(17999);
  });
});
