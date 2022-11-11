import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import { erc20, getUSDCSigner, parseEther, parseUSDC } from '@testhelp/helpers';
import type {
  ConnextHandlerMock,
  Controller,
  DerbyToken,
  GameMock,
  LZEndpointMock,
  MainVaultMock,
  XChainControllerMock,
  XProvider,
} from '@typechain';
import {
  deployConnextHandlerMock,
  deployController,
  deployDerbyToken,
  deployGameMock,
  deployLZEndpointMock,
  deployMainVaultMock,
  deployXChainControllerMock,
  deployXProvider,
} from '@testhelp/deploy';
import { usdc, starterProtocols as protocols } from '@testhelp/addresses';
import { initController, rebalanceETF } from '@testhelp/vaultHelpers';
import allProviders from '@testhelp/allProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';

const amount = 100_000;
const chainIds = [10, 100, 1000, 2000];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther((1e8).toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe('Testing XChainController, unit test', async () => {
  let vault1: MainVaultMock,
    controller: Controller,
    xChainController: XChainControllerMock,
    xProvider10: XProvider,
    xProvider100: XProvider,
    dao: Signer,
    user: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string,
    LZEndpoint10: LZEndpointMock,
    LZEndpoint100: LZEndpointMock,
    connextHandler: ConnextHandlerMock,
    DerbyToken: DerbyToken,
    game: GameMock;

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  beforeEach(async function () {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress(),
    ]);

    connextHandler = await deployConnextHandlerMock(dao, daoAddr);

    controller = await deployController(dao, daoAddr);
    xChainController = await deployXChainControllerMock(dao, daoAddr, daoAddr, daoAddr, 100);

    DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    game = await deployGameMock(
      user,
      nftName,
      nftSymbol,
      DerbyToken.address,
      controller.address,
      daoAddr,
      daoAddr,
      controller.address,
    );

    [LZEndpoint10, LZEndpoint100] = await Promise.all([
      deployLZEndpointMock(dao, 10),
      deployLZEndpointMock(dao, 100),
    ]);

    [xProvider10, xProvider100] = await Promise.all([
      deployXProvider(
        dao,
        LZEndpoint10.address,
        connextHandler.address,
        daoAddr,
        game.address,
        xChainController.address,
        10,
      ),
      deployXProvider(
        dao,
        LZEndpoint100.address,
        connextHandler.address,
        daoAddr,
        game.address,
        xChainController.address,
        100,
      ),
    ]);

    [vault1] = await Promise.all([
      deployMainVaultMock(
        dao,
        name,
        symbol,
        decimals,
        vaultNumber,
        daoAddr,
        daoAddr,
        userAddr,
        controller.address,
        usdc,
        uScale,
        gasFeeLiquidity,
      ),
    ]);

    await Promise.all([
      xProvider10.setXControllerProvider(xProvider100.address),
      xProvider100.setXControllerProvider(xProvider100.address),
      xProvider10.setXControllerChainId(100),
      xProvider100.setXControllerChainId(100),
      xProvider10.setGameChainId(10),
      xProvider100.setGameChainId(10),
      xProvider10.setTrustedRemote(100, xProvider100.address),
      xProvider100.setTrustedRemote(10, xProvider10.address),
      xProvider10.toggleVaultWhitelist(vault1.address),
    ]);

    await Promise.all([
      game.connect(dao).setXProvider(xProvider10.address),
      game.connect(dao).setChainIds(chainIds),
      game.connect(dao).setLatestProtocolId(10, 5),
      game.connect(dao).setVaultAddress(vaultNumber, 10, vault1.address),
    ]);

    await Promise.all([
      LZEndpoint10.setDestLzEndpoint(xProvider100.address, LZEndpoint100.address),
      LZEndpoint100.setDestLzEndpoint(xProvider10.address, LZEndpoint10.address),
    ]);

    await Promise.all([
      initController(controller, [userAddr, game.address, vault1.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(5)),
      IUSDc.connect(user).approve(vault1.address, amountUSDC),
    ]);

    await Promise.all([vault1.setHomeXProvider(xProvider10.address), vault1.setChainIds(10)]);

    await Promise.all([
      xChainController.setVaultChainAddress(vaultNumber, 10, vault1.address, usdc),
      xChainController.setHomeXProviderAddress(xProvider100.address), // xChainController on chain 100
      xChainController.connect(dao).setChainIds(chainIds),
    ]);

    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, vaultNumber, allProviders);
    }
  });

  it('Testing vault rebalanceXChain', async function () {
    // Rebalancing the vault for setup funds in protocols
    await vault1.setDeltaAllocationsReceivedTEST(true);
    await vault1.connect(user).deposit(amountUSDC);

    await Promise.all([
      compoundVault.setDeltaAllocation(vault1, dao, 40),
      aaveVault.setDeltaAllocation(vault1, dao, 60),
      yearnVault.setDeltaAllocation(vault1, dao, 20),
    ]);

    await vault1.setVaultState(3);
    await rebalanceETF(vault1);

    // Testing rebalance X Chain function
    await vault1.setVaultState(1);
    await vault1.setAmountToSendXChainTEST(amountUSDC.div(2)); // 50k
    await vault1.rebalanceXChain();

    const balance = await IUSDc.balanceOf(xChainController.address);
    expect(balance).to.be.equal(amountUSDC.div(2)); // 50k
  });
});
