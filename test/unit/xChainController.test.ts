import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import { erc20, formatUSDC, getUSDCSigner, parseEther, parseUSDC } from '@testhelp/helpers';
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
import { testConnextChainIds, testLayerzeroChainIds, usdc } from '@testhelp/addresses';
import { initController } from '@testhelp/vaultHelpers';
import allProviders from '@testhelp/allProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';

const { bnbChain, goerli, arbitrumGoerli, optimismGoerli } = testLayerzeroChainIds;

const amount = 100_000;
const chainIds = [goerli, arbitrumGoerli, optimismGoerli, bnbChain];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther((1e8).toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe('Testing XChainController, unit test', async () => {
  let vault1: MainVaultMock,
    vault2: MainVaultMock,
    vault3: MainVaultMock,
    vault4: MainVaultMock,
    controller: Controller,
    xChainController: XChainControllerMock,
    xProviderGoerli: XProvider,
    xProviderArbitrum: XProvider,
    xProviderOptimism: XProvider,
    xProviderBnbChain: XProvider,
    dao: Signer,
    user: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string,
    LZEndpointGoerli: LZEndpointMock,
    LZEndpointArbitrumGoerli: LZEndpointMock,
    LZEndpointOptimismGoerli: LZEndpointMock,
    LZEndpointBnbChain: LZEndpointMock,
    connextHandler: ConnextHandlerMock,
    DerbyToken: DerbyToken,
    game: GameMock;

  before(async function () {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress(),
    ]);

    connextHandler = await deployConnextHandlerMock(dao, daoAddr);

    controller = await deployController(dao, daoAddr);
    xChainController = await deployXChainControllerMock(
      dao,
      daoAddr,
      daoAddr,
      daoAddr,
      arbitrumGoerli,
    );

    DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    game = await deployGameMock(
      user,
      nftName,
      nftSymbol,
      DerbyToken.address,
      daoAddr,
      daoAddr,
      controller.address,
    );

    [LZEndpointGoerli, LZEndpointArbitrumGoerli, LZEndpointOptimismGoerli, LZEndpointBnbChain] =
      await Promise.all([
        deployLZEndpointMock(dao, goerli),
        deployLZEndpointMock(dao, arbitrumGoerli),
        deployLZEndpointMock(dao, optimismGoerli),
        deployLZEndpointMock(dao, bnbChain),
      ]);

    [xProviderGoerli, xProviderArbitrum, xProviderOptimism, xProviderBnbChain] = await Promise.all([
      deployXProvider(
        dao,
        LZEndpointGoerli.address,
        connextHandler.address,
        daoAddr,
        game.address,
        xChainController.address,
        goerli,
      ),
      deployXProvider(
        dao,
        LZEndpointArbitrumGoerli.address,
        connextHandler.address,
        daoAddr,
        game.address,
        xChainController.address,
        arbitrumGoerli,
      ),
      deployXProvider(
        dao,
        LZEndpointOptimismGoerli.address,
        connextHandler.address,
        daoAddr,
        game.address,
        xChainController.address,
        optimismGoerli,
      ),
      deployXProvider(
        dao,
        LZEndpointBnbChain.address,
        connextHandler.address,
        daoAddr,
        game.address,
        xChainController.address,
        bnbChain,
      ),
    ]);

    [vault1, vault2, vault3, vault4] = await Promise.all([
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
      xProviderGoerli.setXControllerProvider(xProviderArbitrum.address),
      xProviderArbitrum.setXControllerProvider(xProviderArbitrum.address),
      xProviderOptimism.setXControllerProvider(xProviderArbitrum.address),
      xProviderBnbChain.setXControllerProvider(xProviderArbitrum.address),
      xProviderGoerli.setXControllerChainId(arbitrumGoerli),
      xProviderArbitrum.setXControllerChainId(arbitrumGoerli),
      xProviderOptimism.setXControllerChainId(arbitrumGoerli),
      xProviderBnbChain.setXControllerChainId(arbitrumGoerli),
      xProviderGoerli.setGameChainId(goerli),
      xProviderArbitrum.setGameChainId(goerli),
      xProviderOptimism.setGameChainId(goerli),
      xProviderBnbChain.setGameChainId(goerli),
      xProviderGoerli.setTrustedRemote(arbitrumGoerli, xProviderArbitrum.address),
      xProviderGoerli.setTrustedRemote(optimismGoerli, xProviderOptimism.address),
      xProviderGoerli.setTrustedRemote(bnbChain, xProviderBnbChain.address),
      xProviderArbitrum.setTrustedRemote(goerli, xProviderGoerli.address),
      xProviderArbitrum.setTrustedRemote(optimismGoerli, xProviderOptimism.address),
      xProviderArbitrum.setTrustedRemote(bnbChain, xProviderBnbChain.address),
      xProviderOptimism.setTrustedRemote(goerli, xProviderGoerli.address),
      xProviderOptimism.setTrustedRemote(arbitrumGoerli, xProviderArbitrum.address),
      xProviderOptimism.setTrustedRemote(bnbChain, xProviderBnbChain.address),
      xProviderBnbChain.setTrustedRemote(goerli, xProviderGoerli.address),
      xProviderBnbChain.setTrustedRemote(arbitrumGoerli, xProviderArbitrum.address),
      xProviderBnbChain.setTrustedRemote(optimismGoerli, xProviderOptimism.address),
      xProviderGoerli.toggleVaultWhitelist(vault1.address),
      xProviderArbitrum.toggleVaultWhitelist(vault2.address),
      xProviderOptimism.toggleVaultWhitelist(vault3.address),
      xProviderBnbChain.toggleVaultWhitelist(vault4.address),

      xProviderGoerli.setConnextChainId(goerli, testConnextChainIds.goerli),
      xProviderGoerli.setConnextChainId(optimismGoerli, testConnextChainIds.optimismGoerli),
      xProviderGoerli.setConnextChainId(arbitrumGoerli, testConnextChainIds.mumbai), // arbitrum not supported
      xProviderArbitrum.setConnextChainId(goerli, testConnextChainIds.goerli),
      xProviderArbitrum.setConnextChainId(optimismGoerli, testConnextChainIds.optimismGoerli),
      xProviderArbitrum.setConnextChainId(arbitrumGoerli, testConnextChainIds.mumbai), // arbitrum not supported
      xProviderOptimism.setConnextChainId(goerli, testConnextChainIds.goerli),
      xProviderOptimism.setConnextChainId(optimismGoerli, testConnextChainIds.optimismGoerli),
      xProviderOptimism.setConnextChainId(arbitrumGoerli, testConnextChainIds.mumbai), // arbitrum not supported
    ]);

    await Promise.all([
      game.connect(dao).setXProvider(xProviderGoerli.address),
      game.connect(dao).setChainIds(chainIds),
      game.connect(dao).setLatestProtocolId(goerli, 5),
      game.connect(dao).setLatestProtocolId(arbitrumGoerli, 5),
      game.connect(dao).setLatestProtocolId(optimismGoerli, 5),
      game.connect(dao).setLatestProtocolId(bnbChain, 5),
      game.connect(dao).setVaultAddress(vaultNumber, goerli, vault1.address),
      game.connect(dao).setVaultAddress(vaultNumber, arbitrumGoerli, vault2.address),
      game.connect(dao).setVaultAddress(vaultNumber, optimismGoerli, vault3.address),
      game.connect(dao).setVaultAddress(vaultNumber, bnbChain, vault4.address),
    ]);

    await Promise.all([
      LZEndpointGoerli.setDestLzEndpoint(
        xProviderArbitrum.address,
        LZEndpointArbitrumGoerli.address,
      ),
      LZEndpointGoerli.setDestLzEndpoint(
        xProviderOptimism.address,
        LZEndpointOptimismGoerli.address,
      ),
      LZEndpointGoerli.setDestLzEndpoint(xProviderBnbChain.address, LZEndpointBnbChain.address),
      LZEndpointArbitrumGoerli.setDestLzEndpoint(xProviderGoerli.address, LZEndpointGoerli.address),
      LZEndpointArbitrumGoerli.setDestLzEndpoint(
        xProviderOptimism.address,
        LZEndpointOptimismGoerli.address,
      ),
      LZEndpointArbitrumGoerli.setDestLzEndpoint(
        xProviderBnbChain.address,
        LZEndpointBnbChain.address,
      ),
      LZEndpointOptimismGoerli.setDestLzEndpoint(xProviderGoerli.address, LZEndpointGoerli.address),
      LZEndpointOptimismGoerli.setDestLzEndpoint(
        xProviderArbitrum.address,
        LZEndpointArbitrumGoerli.address,
      ),
      LZEndpointOptimismGoerli.setDestLzEndpoint(
        xProviderBnbChain.address,
        LZEndpointBnbChain.address,
      ),
      LZEndpointBnbChain.setDestLzEndpoint(xProviderGoerli.address, LZEndpointGoerli.address),
      LZEndpointBnbChain.setDestLzEndpoint(
        xProviderArbitrum.address,
        LZEndpointArbitrumGoerli.address,
      ),
      LZEndpointBnbChain.setDestLzEndpoint(
        xProviderOptimism.address,
        LZEndpointOptimismGoerli.address,
      ),
    ]);

    await Promise.all([
      initController(controller, [
        userAddr,
        game.address,
        vault1.address,
        vault2.address,
        vault3.address,
      ]),

      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(5)),
      IUSDc.connect(user).approve(vault1.address, amountUSDC),
      IUSDc.connect(user).approve(vault2.address, amountUSDC.mul(2)),
    ]);

    await Promise.all([
      vault1.setHomeXProvider(xProviderGoerli.address),
      vault2.setHomeXProvider(xProviderArbitrum.address),
      vault3.setHomeXProvider(xProviderOptimism.address),
      vault4.setHomeXProvider(xProviderBnbChain.address),
      vault1.setChainIds(goerli),
      vault2.setChainIds(arbitrumGoerli),
      vault3.setChainIds(optimismGoerli),
      vault4.setChainIds(bnbChain),
    ]);

    await Promise.all([
      xChainController.setVaultChainAddress(vaultNumber, goerli, vault1.address, usdc),
      xChainController.setVaultChainAddress(vaultNumber, arbitrumGoerli, vault2.address, usdc),
      xChainController.setVaultChainAddress(vaultNumber, optimismGoerli, vault3.address, usdc),
      xChainController.setVaultChainAddress(vaultNumber, bnbChain, vault4.address, usdc),
      xChainController.setHomeXProvider(xProviderArbitrum.address), // xChainController on chain 100
      xChainController.connect(dao).setChainIds(chainIds),
    ]);
  });

  it('Testing provider settings', async function () {
    expect(await xProviderGoerli.connextChainId(goerli)).to.be.equal(testConnextChainIds.goerli);
    expect(await xProviderGoerli.connextChainId(optimismGoerli)).to.be.equal(
      testConnextChainIds.optimismGoerli,
    );
    expect(await xProviderGoerli.connextChainId(arbitrumGoerli)).to.be.equal(
      testConnextChainIds.mumbai,
    );
  });

  it('1) Store allocations in Game contract', async function () {
    await game.mintNewBasket(vaultNumber);

    const allocationArray = [
      [200, 0, 0, 200, 0], // 400
      [100, 0, 200, 100, 200], // 600
      [0, 100, 200, 300, 400], // 1000
      [0, 0, 0, 0, 0], // 0
    ];
    const totalAllocations = 2000;

    await DerbyToken.increaseAllowance(game.address, totalAllocations);
    await game.rebalanceBasket(vaultNumber, allocationArray);

    expect(await game.basketTotalAllocatedTokens(vaultNumber)).to.be.equal(totalAllocations);

    // looping through all of allocationArray
    allocationArray.forEach(async (chainIdArray, i) => {
      for (let j = 0; j < chainIdArray.length; j++) {
        expect(await game.basketAllocationInProtocol(vaultNumber, chainIds[i], j)).to.be.equal(
          chainIdArray[j],
        );
      }
    });
  });

  it('1.5) Store vault stages', async function () {
    await xChainController.setActiveVaultsTEST(vaultNumber, 1);

    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(false);

    await xChainController.setReadyTEST(vaultNumber, true);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);

    await xChainController.setAllocationsReceivedTEST(vaultNumber, true);
    expect(await xChainController.getAllocationState(vaultNumber)).to.be.equal(true);

    await xChainController.upUnderlyingReceivedTEST(vaultNumber);
    expect(await xChainController.getUnderlyingState(vaultNumber)).to.be.equal(1);

    await xChainController.resetVaultStagesTEST(vaultNumber);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);
    expect(await xChainController.getAllocationState(vaultNumber)).to.be.equal(false);
    expect(await xChainController.getUnderlyingState(vaultNumber)).to.be.equal(0);
    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(0);

    // chainId on or off
    expect(await xChainController.getVaultChainIdOff(vaultNumber, goerli)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, arbitrumGoerli)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, optimismGoerli)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, bnbChain)).to.be.false;
  });

  it('2) Game pushes delta allocations to xChainController', async function () {
    await xChainController.connect(dao).resetVaultStagesDao(vaultNumber);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);
    // chainIds = [10, 100, 1000, 2000];
    await expect(game.pushAllocationsToController(vaultNumber))
      .to.emit(game, 'PushedAllocationsToController')
      .withArgs(vaultNumber, [400, 600, 1000]);

    // checking of allocations are correctly set in xChainController
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(2000);
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[0])).to.be.equal(
      400,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[1])).to.be.equal(
      600,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[2])).to.be.equal(
      1000,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[3])).to.be.equal(
      0,
    );

    // chainId on or off
    expect(await xChainController.getVaultChainIdOff(vaultNumber, goerli)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, arbitrumGoerli)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, optimismGoerli)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, bnbChain)).to.be.true;

    expect(await vault4.vaultOff()).to.be.true;
  });

  it('3) Trigger vaults to push totalUnderlyings to xChainController', async function () {
    await vault1.connect(user).deposit(100_000 * 1e6);
    await vault2.connect(user).deposit(200_000 * 1e6);

    await vault2.setExchangeRateTEST(1.2 * 1e6);
    await vault2.connect(user).withdrawalRequest(50_000 * 1e6);

    await vault1.pushTotalUnderlyingToController();
    await vault2.pushTotalUnderlyingToController();
    await vault3.pushTotalUnderlyingToController();

    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(250_000 * 1e6);
    expect(
      await xChainController.getWithdrawalRequestsTEST(vaultNumber, arbitrumGoerli),
    ).to.be.equal(50_000 * 1.2 * 1e6);
    expect(await xChainController.getTotalWithdrawalRequestsTEST(vaultNumber)).to.be.equal(
      50_000 * 1.2 * 1e6,
    );

    // // Should revert if total Underlying is already set
    await expect(vault1.pushTotalUnderlyingToController()).to.be.revertedWith('Rebalancing');

    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, goerli)).to.be.equal(
      100_000 * 1e6,
    );
    expect(
      await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, arbitrumGoerli),
    ).to.be.equal(200_000 * 1e6);
    expect(
      await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, optimismGoerli),
    ).to.be.equal(0);

    const totalUnderlying = await xChainController.getTotalUnderlyingVaultTEST(vaultNumber);
    expect(totalUnderlying).to.be.equal(300_000 * 1e6);
  });

  it('4) Calc and set amount to deposit or withdraw in vault', async function () {
    await xChainController.pushVaultAmounts(vaultNumber);

    // balanceVault - ( allocation * totalUnderlying ) - withdrawRequests
    const expectedAmounts = [
      100_000 - (400 / 2000) * 240_000 - 0, // vault 1 = 52_000
      200_000 - (600 / 2000) * 240_000 - 60_000, // vault 2 = 68_000
      0, // vault 3 = Receiving 120_000
      0, // vault 4
    ];
    const expectedExchangeRate = (240_000 / 250_000) * 1e6; // == 0.96

    expect(formatUSDC(await vault1.amountToSendXChain())).to.be.equal(expectedAmounts[0]);
    expect(formatUSDC(await vault2.amountToSendXChain())).to.be.equal(expectedAmounts[1]);
    expect(formatUSDC(await vault3.amountToSendXChain())).to.be.equal(expectedAmounts[2]);
    expect(formatUSDC(await vault4.amountToSendXChain())).to.be.equal(expectedAmounts[3]);

    expect(await vault1.exchangeRate()).to.be.equal(expectedExchangeRate);
    expect(await vault2.exchangeRate()).to.be.equal(expectedExchangeRate);
    expect(await vault3.exchangeRate()).to.be.equal(expectedExchangeRate);

    // Checking if vault states upped correctly
    expect(await vault1.state()).to.be.equal(2);
    expect(await vault2.state()).to.be.equal(2);
    expect(await vault3.state()).to.be.equal(3); // dont have to send any funds
    expect(await vault4.state()).to.be.equal(0); // chainId off
  });

  it('4.5) Trigger vaults to transfer funds to xChainController', async function () {
    await vault1.rebalanceXChain();
    await vault2.rebalanceXChain();
    await vault3.rebalanceXChain();

    // 150k should be sent to xChainController
    expect(await IUSDc.balanceOf(xChainController.address)).to.be.equal((52_000 + 68_000) * 1e6);
    expect(await IUSDc.balanceOf(vault1.address)).to.be.equal(48_000 * 1e6); // 100k - 52k
    expect(await IUSDc.balanceOf(vault2.address)).to.be.equal(132_000 * 1e6); // 200k - 68k
    expect(await IUSDc.balanceOf(vault3.address)).to.be.equal(0);

    expect(await vault1.state()).to.be.equal(4); // should have upped after sending funds
    expect(await vault2.state()).to.be.equal(4); // should have upped after sending funds
    expect(await vault3.state()).to.be.equal(3); // have to receive funds

    // all 3 vaults are ready
    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(3);
  });

  it('5) Trigger xChainController to send funds to vaults', async function () {
    await xChainController.sendFundsToVault(vaultNumber);

    const expectedAmounts = [
      (400 / 2000) * 240_000, // vault 1
      (600 / 2000) * 240_000 + 60_000, // vault 2 should have the request of 60k
      (1000 / 2000) * 240_000, // vault 3 should have received 150k from controller
    ];

    // reserved funds of vault2 should be 60k at this point
    expect(await vault2.getReservedFundsTEST()).to.be.equal(60_000 * 1e6);
    expect(await vault2.getTotalWithdrawalRequestsTEST()).to.be.equal(0);

    expect(formatUSDC(await IUSDc.balanceOf(vault1.address))).to.be.equal(expectedAmounts[0]);
    expect(formatUSDC(await IUSDc.balanceOf(vault2.address))).to.be.equal(expectedAmounts[1]);
    expect(formatUSDC(await IUSDc.balanceOf(vault3.address))).to.be.equal(expectedAmounts[2]);

    expect(formatUSDC(await vault1.getVaultBalance())).to.be.equal(expectedAmounts[0]);
    expect(formatUSDC(await vault2.getVaultBalance())).to.be.equal(expectedAmounts[1] - 60_000);
    expect(formatUSDC(await vault3.getVaultBalance())).to.be.equal(expectedAmounts[2]);

    expect(await vault3.state()).to.be.equal(4); // received funds, all vaults should be ready now
  });

  it('6) Push allocations from game to vaults', async function () {
    expect(await game.isXChainRebalancing(vaultNumber)).to.be.true;
    await game.pushAllocationsToVaults(vaultNumber);
    expect(await game.isXChainRebalancing(vaultNumber)).to.be.false;

    const allocationArray = [
      [200, 0, 0, 200, 0], // 400
      [100, 0, 200, 100, 200], // 600
      [0, 100, 200, 300, 400], // 1000
      [0, 0, 0, 0, 0], // 0
    ];

    // vault 1
    allocationArray[0].forEach(async (_, i) =>
      expect(await vault1.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[0][i]),
    );
    // vault 2
    allocationArray[1].forEach(async (_, i) =>
      expect(await vault2.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[1][i]),
    );
    // vault 3
    allocationArray[2].forEach(async (_, i) =>
      expect(await vault3.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[2][i]),
    );
    // vault 4
    allocationArray[3].forEach(async (_, i) =>
      expect(await vault4.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[3][i]),
    );

    expect(await vault1.deltaAllocationsReceived()).to.be.true;
    expect(await vault2.deltaAllocationsReceived()).to.be.true;
    expect(await vault3.deltaAllocationsReceived()).to.be.true;
    expect(await vault4.deltaAllocationsReceived()).to.be.true;
  });

  it('Should correctly set dao address', async function () {
    await game.connect(dao).setDao(userAddr);
    expect(await xChainController.getDao()).to.be.equal(userAddr);
  });
});
