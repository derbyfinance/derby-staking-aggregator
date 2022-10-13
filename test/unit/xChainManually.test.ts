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

const { goerli, arbitrumGoerli } = testLayerzeroChainIds;

const amount = 500_000;
const chainIds = [goerli, arbitrumGoerli];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther((1e8).toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe('Testing XChainController, unit test', async () => {
  let vault1: MainVaultMock,
    vault2: MainVaultMock,
    controller: Controller,
    xChainController: XChainControllerMock,
    xChainControllerDUMMY: XChainControllerMock,
    xProviderGoerli: XProvider,
    xProviderArbitrum: XProvider,
    dao: Signer,
    user: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string,
    LZEndpointGoerli: LZEndpointMock,
    LZEndpointArbitrumGoerli: LZEndpointMock,
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
    xChainController = await deployXChainControllerMock(dao, daoAddr, daoAddr, arbitrumGoerli);
    xChainControllerDUMMY = await deployXChainControllerMock(dao, daoAddr, daoAddr, arbitrumGoerli);

    DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    game = await deployGameMock(
      user,
      nftName,
      nftSymbol,
      DerbyToken.address,
      controller.address,
      daoAddr,
      controller.address,
    );

    [LZEndpointGoerli, LZEndpointArbitrumGoerli] = await Promise.all([
      deployLZEndpointMock(dao, goerli),
      deployLZEndpointMock(dao, arbitrumGoerli),
    ]);

    [xProviderGoerli, xProviderArbitrum] = await Promise.all([
      deployXProvider(
        dao,
        LZEndpointGoerli.address,
        connextHandler.address,
        daoAddr,
        game.address,
        xChainControllerDUMMY.address,
        goerli,
      ),
      deployXProvider(
        dao,
        LZEndpointArbitrumGoerli.address,
        connextHandler.address,
        daoAddr,
        game.address,
        xChainControllerDUMMY.address,
        arbitrumGoerli,
      ),
    ]);

    [vault1, vault2] = await Promise.all([
      deployMainVaultMock(
        dao,
        name,
        symbol,
        decimals,
        ETFname,
        vaultNumber,
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
        ETFname,
        vaultNumber,
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
      xProviderGoerli.setXControllerChainId(arbitrumGoerli),
      xProviderArbitrum.setXControllerChainId(arbitrumGoerli),
      xProviderGoerli.setGameChainId(goerli),
      xProviderArbitrum.setGameChainId(goerli),
      xProviderGoerli.setTrustedRemote(arbitrumGoerli, xProviderArbitrum.address),
      xProviderArbitrum.setTrustedRemote(goerli, xProviderGoerli.address),
      xProviderGoerli.toggleVaultWhitelist(vault1.address),
      xProviderArbitrum.toggleVaultWhitelist(vault2.address),
      xProviderGoerli.setConnextChainId(goerli, testConnextChainIds.goerli),
      xProviderGoerli.setConnextChainId(arbitrumGoerli, testConnextChainIds.mumbai), // arbitrum not supported
      xProviderArbitrum.setConnextChainId(goerli, testConnextChainIds.goerli),
      xProviderArbitrum.setConnextChainId(arbitrumGoerli, testConnextChainIds.mumbai), // arbitrum not supported
    ]);

    await Promise.all([
      game.connect(dao).setXProvider(xProviderGoerli.address),
      game.connect(dao).setChainIdArray(chainIds),
      game.connect(dao).addETF(vault1.address),
      game.connect(dao).setLatestProtocolId(goerli, 5),
      game.connect(dao).setLatestProtocolId(arbitrumGoerli, 5),
      game.connect(dao).setVaultAddress(vaultNumber, goerli, vault1.address),
      game.connect(dao).setVaultAddress(vaultNumber, arbitrumGoerli, vault2.address),
    ]);

    await Promise.all([
      LZEndpointGoerli.setDestLzEndpoint(
        xProviderArbitrum.address,
        LZEndpointArbitrumGoerli.address,
      ),
      LZEndpointArbitrumGoerli.setDestLzEndpoint(xProviderGoerli.address, LZEndpointGoerli.address),
    ]);

    await Promise.all([
      initController(controller, [userAddr, game.address, vault1.address, vault2.address]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(5)),
      IUSDc.connect(user).approve(vault1.address, amountUSDC),
      IUSDc.connect(user).approve(vault2.address, amountUSDC.mul(2)),
    ]);

    await Promise.all([
      vault1.setXControllerAddress(xChainControllerDUMMY.address),
      vault2.setXControllerAddress(xChainControllerDUMMY.address),
      vault1.setHomeXProviderAddress(xProviderGoerli.address),
      vault2.setHomeXProviderAddress(xProviderArbitrum.address),
      vault1.setChainIds(goerli),
      vault2.setChainIds(arbitrumGoerli),
    ]);

    await Promise.all([
      xChainController.setVaultChainAddress(vaultNumber, goerli, vault1.address, usdc),
      xChainController.setVaultChainAddress(vaultNumber, arbitrumGoerli, vault2.address, usdc),
      xChainController.setHomeXProviderAddress(xProviderArbitrum.address), // xChainController on chain 100
      xChainController.connect(dao).setChainIdArray(chainIds),
      xChainControllerDUMMY.setVaultChainAddress(vaultNumber, goerli, vault1.address, usdc),
      xChainControllerDUMMY.setVaultChainAddress(vaultNumber, arbitrumGoerli, vault2.address, usdc),
      xChainControllerDUMMY.setHomeXProviderAddress(xProviderArbitrum.address),
      xChainControllerDUMMY.connect(dao).setChainIdArray(chainIds),
    ]);
  });

  it('1) Store allocations in Game contract', async function () {
    await game.mintNewBasket(vaultNumber);

    const allocationArray = [
      [100 * 1e6, 0, 100 * 1e6, 100 * 1e6, 100 * 1e6], // 400
      [100 * 1e6, 0, 0, 0, 0], // 100
    ];
    const totalAllocations = 500 * 1e6;

    await DerbyToken.increaseAllowance(game.address, totalAllocations);
    await game.rebalanceBasket(vaultNumber, allocationArray);

    expect(await game.basketTotalAllocatedTokens(vaultNumber)).to.be.equal(totalAllocations);
  });

  it('Only be called by Guardian', async function () {});

  it('Test Guardian setters in xChainController', async function () {
    // sending funds
    let stages = await xChainController.vaultStage(vaultNumber);

    expect(stages.activeVaults).to.be.equal(0);
    expect(stages.ready).to.be.equal(false);
    expect(stages.allocationsReceived).to.be.equal(false);
    expect(stages.underlyingReceived).to.be.equal(0);
    expect(stages.fundsReceived).to.be.equal(0);

    await xChainController.setActiveVaultsGuard(vaultNumber, 5);
    await xChainController.setReadyGuard(vaultNumber, true);
    await xChainController.setAllocationsReceivedGuard(vaultNumber, true);
    await xChainController.setUnderlyingReceivedGuard(vaultNumber, 10);
    await xChainController.setFundsReceivedGuard(vaultNumber, 15);

    stages = await xChainController.vaultStage(vaultNumber);

    expect(stages.activeVaults).to.be.equal(5);
    expect(stages.ready).to.be.equal(true);
    expect(stages.allocationsReceived).to.be.equal(true);
    expect(stages.underlyingReceived).to.be.equal(10);
    expect(stages.fundsReceived).to.be.equal(15);

    await vault1.setVaultStateGuard(2);
    expect(await vault1.state()).to.be.equal(2);
    await vault1.setVaultStateGuard(5);
    expect(await vault1.state()).to.be.equal(5);

    // Reset
    await xChainController.setActiveVaultsGuard(vaultNumber, 0);
    await vault1.setVaultStateGuard(0);
  });

  it('Step 1: Game pushes totalDeltaAllocations to xChainController', async function () {
    // Setting a dummy Controller here so transaction below succeeds but doesnt arrive in the correct Controller
    // Will be corrected by the guardian
    await xChainControllerDUMMY.connect(dao).resetVaultStagesDao(vaultNumber);
    await xChainController.connect(dao).resetVaultStagesDao(vaultNumber);

    // Should emit event with the allocations from above
    await expect(game.pushAllocationsToController(vaultNumber))
      .to.emit(game, 'PushedAllocationsToController')
      .withArgs(vaultNumber, [400 * 1e6, 100 * 1e6]);

    // Allocations in xChainController should still be 0 cause of the Dummy
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(0);

    await xChainController.receiveAllocationsFromGameGuard(vaultNumber, [400 * 1e6, 100 * 1e6]);

    // Checking if allocations are correctly set in xChainController
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(
      500 * 1e6,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[0])).to.be.equal(
      400 * 1e6,
    );
  });

  it('Step 2: Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests to xChainController', async function () {
    await vault1.connect(user).deposit(400_000 * 1e6);
    await vault2.connect(user).deposit(1000 * 1e6);

    await expect(vault1.pushTotalUnderlyingToController())
      .to.emit(vault1, 'PushTotalUnderlying')
      .withArgs(vaultNumber, goerli, 400_000 * 1e6, 400_000 * 1e6, 0);

    await expect(vault2.pushTotalUnderlyingToController())
      .to.emit(vault2, 'PushTotalUnderlying')
      .withArgs(vaultNumber, arbitrumGoerli, 1000 * 1e6, 1000 * 1e6, 0);

    // should have been send to DUMMY so this should be 0
    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(0);

    // Guardian calls manually
    await Promise.all([
      xChainController.setTotalUnderlyingGuard(
        vaultNumber,
        goerli,
        400_000 * 1e6,
        400_000 * 1e6,
        0,
      ),
      xChainController.setTotalUnderlyingGuard(
        vaultNumber,
        arbitrumGoerli,
        1000 * 1e6,
        1000 * 1e6,
        0,
      ),
    ]);

    expect(await xChainController.getTotalUnderlyingVaultTEST(vaultNumber)).to.be.equal(
      401_000 * 1e6,
    );
    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(401_000 * 1e6);
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, goerli)).to.be.equal(
      400_000 * 1e6,
    );
    expect(
      await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, arbitrumGoerli),
    ).to.be.equal(1000 * 1e6);
  });

  it('Step 3: xChainController pushes exchangeRate amount to send X Chain', async function () {
    const expectedAmounts = [400_000 - (400 / 500) * 401_000, 0];

    // Sending values to dummy vaults
    await expect(xChainControllerDUMMY.pushVaultAmounts(vaultNumber))
      .to.emit(xChainControllerDUMMY, 'SendXChainAmount')
      .withArgs(vault1.address, goerli, expectedAmounts[0] * 1e6, 1 * 1e6);

    expect(formatUSDC(await vault1.amountToSendXChain())).to.be.equal(expectedAmounts[0]);
    expect(formatUSDC(await vault2.amountToSendXChain())).to.be.equal(expectedAmounts[1]);

    // Test guardian function
    await vault1.setXChainAllocationGuard(2000, 1.5 * 1e6);
    await vault2.setXChainAllocationGuard(1000, 1.5 * 1e6);

    expect(await vault1.amountToSendXChain()).to.be.equal(2000);
    expect(await vault2.amountToSendXChain()).to.be.equal(1000);
    expect(await vault1.exchangeRate()).to.be.equal(1.5 * 1e6);
    expect(await vault2.exchangeRate()).to.be.equal(1.5 * 1e6);

    // set state back for next step
    await vault1.setXChainAllocationGuard(expectedAmounts[0] * 1e6, 1 * 1e6);
    await vault2.setXChainAllocationGuard(0, 1 * 1e6);
  });

  it('Step 4: Push funds from vaults to xChainControlle', async function () {
    await vault1.rebalanceXChain();
    await vault2.rebalanceXChain();

    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(0);
    // Manually up funds received because feedback is sent to DUMMY controller
    await xChainController.setFundsReceivedGuard(vaultNumber, 2);
    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(2);
  });

  it('Step 5: Push funds from xChainController to vaults', async function () {
    expect(await vault2.state()).to.be.equal(3);
    // Manually receiving funds (funds it self or not actually received)
    await vault2.receiveFundsGuard();

    expect(await vault1.state()).to.be.equal(4);
    expect(await vault2.state()).to.be.equal(4);
  });

  it('Step 6: Game pushes deltaAllocations to vaults', async function () {
    const allocationArray = [100 * 1e6, 0, 200 * 1e6, 300 * 1e6, 400 * 1e6];

    // Manually setting protcol allocations
    await vault1.receiveProtocolAllocationsGuard(allocationArray);

    for (let i = 0; i < allocationArray.length; i++) {
      expect(await vault1.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[i]);
    }

    expect(await vault1.deltaAllocationsReceived()).to.be.true;
  });

  it('Step 8: Vaults push rewardsPerLockedToken to game', async function () {
    await game.upRebalancingPeriod(vaultNumber);

    const vault1Rewards = [1 * 1e6, 0, 2 * 1e6, 3 * 1e6, 4 * 1e6];
    const vault2Rewards = [0, 0, 0, 6 * 1e6, 7 * 1e6];

    await game.connect(dao).settleRewardsGuard(vaultNumber, goerli, vault1Rewards);
    await game.connect(dao).settleRewardsGuard(vaultNumber, arbitrumGoerli, vault2Rewards);

    for (let i = 0; i < vault1Rewards.length; i++) {
      expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, goerli, 1, i)).to.be.equal(
        vault1Rewards[i],
      );
      expect(
        await game.getRewardsPerLockedTokenTEST(vaultNumber, arbitrumGoerli, 1, i),
      ).to.be.equal(vault2Rewards[i]);
    }
  });
});
