import { deployments, ethers, run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import {
  erc20,
  formatUSDC,
  getUSDCSigner,
  parseEther,
  parseUSDC,
  transferAndApproveUSDC,
} from '@testhelp/helpers';
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
import { deployXChainControllerMock } from '@testhelp/deploy';
import { usdc } from '@testhelp/addresses';
import {
  getAllSigners,
  getContract,
  getXProviders,
  InitEndpoints,
  InitGame,
  InitVault,
  InitXController,
} from '@testhelp/deployHelpers';
import { vaultDeploySettings } from 'deploySettings';

const amount = 500_000;
const chainIds = [10, 100];

const amountUSDC = parseUSDC(amount.toString());

describe('Testing XChainController, unit test', async () => {
  let vault1: MainVaultMock,
    vault2: MainVaultMock,
    xChainController: XChainControllerMock,
    xChainControllerDUMMY: XChainControllerMock,
    dao: Signer,
    user: Signer,
    guardian: Signer,
    IUSDc: Contract = erc20(usdc),
    derbyToken: DerbyToken,
    game: GameMock,
    vaultNumber: BigNumberish = vaultDeploySettings.vaultNumber;

  const setupXChain = deployments.createFixture(async (hre) => {
    await deployments.fixture([
      'XChainControllerMock',
      'MainVaultMock',
      'Vault2',
      'XProviderMain',
      'XProviderArbi',
      'XProviderOpti',
    ]);

    const [dao, user, guardian] = await getAllSigners(hre);
    const vaultNumber = vaultDeploySettings.vaultNumber;

    const game = (await getContract('GameMock', hre)) as GameMock;
    const controller = (await getContract('Controller', hre)) as Controller;
    const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
    const xChainController = (await getContract(
      'XChainControllerMock',
      hre,
    )) as XChainControllerMock;
    const xChainControllerDUMMY = await deployXChainControllerMock(
      dao,
      dao.address,
      dao.address,
      dao.address,
      100,
    );
    const vault1 = (await getContract('MainVaultMock', hre)) as MainVaultMock;
    const deployment = await deployments.get('Vault2');
    const vault2 = (await hre.ethers.getContractAt(
      'MainVaultMock',
      deployment.address,
    )) as MainVaultMock;

    //await allProviders.setProviders(hre);
    await transferAndApproveUSDC(vault1.address, user, 10_000_000 * 1e6);

    const [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb] = await getXProviders(
      hre,
      dao,
      {
        xController: 100,
        game: 10,
      },
    );

    await InitGame(hre, game, dao, { vaultNumber, gameXProvider: xProviderMain.address, chainIds });

    await InitEndpoints(hre, [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb]);

    await xChainControllerDUMMY.connect(dao).setGuardian(guardian.address);
    await derbyToken.transfer(user.address, parseEther('2100'));

    await run('game_init', { provider: xProviderMain.address });
    await run('controller_init');

    await run('game_set_home_vault', { vault: vault1.address });
    await run('controller_add_vault', { vault: vault1.address });

    await InitVault(vault1, guardian, dao, {
      homeXProvider: xProviderMain.address,
      homeChain: 10,
    });
    await InitVault(vault2, guardian, dao, {
      homeXProvider: xProviderArbi.address,
      homeChain: 100,
    });

    await InitXController(hre, xChainController, guardian, dao, {
      vaultNumber,
      chainIds,
      homeXProvider: xProviderArbi.address,
      // chainVault: vault1.address,
    });

    await InitXController(hre, xChainControllerDUMMY, guardian, dao, {
      vaultNumber,
      chainIds,
      homeXProvider: xProviderArbi.address,
      // chainVault: vault1.address,
    });

    await Promise.all([
      xProviderMain.connect(dao).toggleVaultWhitelist(vault1.address),
      xProviderMain.connect(dao).toggleVaultWhitelist(vault2.address),
      xProviderArbi.connect(dao).toggleVaultWhitelist(vault2.address),

      xProviderMain.connect(dao).setXController(xChainControllerDUMMY.address),
      xProviderArbi.connect(dao).setXController(xChainControllerDUMMY.address),

      game.connect(guardian).setVaultAddress(vaultNumber, 10, vault1.address),
      game.connect(guardian).setVaultAddress(vaultNumber, 100, vault2.address),

      IUSDc.connect(user).approve(vault2.address, amountUSDC.mul(2)),
    ]);

    await Promise.all([
      xChainController.connect(dao).setVaultChainAddress(vaultNumber, 100, vault2.address, usdc),
      xChainControllerDUMMY
        .connect(dao)
        .setVaultChainAddress(vaultNumber, 100, vault2.address, usdc),
    ]);

    return {
      vault1,
      vault2,
      controller,
      game,
      xChainController,
      xChainControllerDUMMY,
      derbyToken,
      dao,
      user,
      guardian,
    };
  });

  before(async function () {
    const setup = await setupXChain();
    vault1 = setup.vault1;
    vault2 = setup.vault2;
    game = setup.game;
    xChainController = setup.xChainController;
    xChainControllerDUMMY = setup.xChainControllerDUMMY;
    derbyToken = setup.derbyToken;
    dao = setup.dao;
    user = setup.user;
    guardian = setup.guardian;
  });

  it('1) Store allocations in Game contract', async function () {
    const basketId = await run('game_mint_basket', { vaultnumber: vaultNumber });

    const allocationArray = [
      [100 * 1e6, 0, 100 * 1e6, 100 * 1e6, 100 * 1e6], // 400
      [100 * 1e6, 0, 0, 0, 0], // 100
    ];
    const totalAllocations = 500 * 1e6;

    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await game.connect(user).rebalanceBasket(basketId, allocationArray);

    expect(await game.connect(user).basketTotalAllocatedTokens(basketId)).to.be.equal(
      totalAllocations,
    );
  });

  it('Only be called by Guardian', async function () {
    await expect(vault1.connect(user).setVaultStateGuard(3)).to.be.revertedWith('only Guardian');
    await expect(game.connect(user).setRebalancingState(vaultNumber, true)).to.be.revertedWith(
      'Game: only Guardian',
    );
    await expect(
      xChainController.connect(user).setReadyGuard(vaultNumber, true),
    ).to.be.revertedWith('xController: only Guardian');
  });

  it('Test Guardian setters in xChainController', async function () {
    // sending funds
    let stages = await xChainController.vaultStage(vaultNumber);

    expect(stages.activeVaults).to.be.equal(0);
    expect(stages.ready).to.be.equal(false);
    expect(stages.allocationsReceived).to.be.equal(false);
    expect(stages.underlyingReceived).to.be.equal(0);
    expect(stages.fundsReceived).to.be.equal(0);

    await xChainController.connect(guardian).setActiveVaultsGuard(vaultNumber, 5);
    await xChainController.connect(guardian).setReadyGuard(vaultNumber, true);
    await xChainController.connect(guardian).setAllocationsReceivedGuard(vaultNumber, true);
    await xChainController.connect(guardian).setUnderlyingReceivedGuard(vaultNumber, 10);
    await xChainController.connect(guardian).setFundsReceivedGuard(vaultNumber, 15);

    stages = await xChainController.vaultStage(vaultNumber);

    expect(stages.activeVaults).to.be.equal(5);
    expect(stages.ready).to.be.equal(true);
    expect(stages.allocationsReceived).to.be.equal(true);
    expect(stages.underlyingReceived).to.be.equal(10);
    expect(stages.fundsReceived).to.be.equal(15);

    await vault1.connect(guardian).setVaultStateGuard(2);
    expect(await vault1.state()).to.be.equal(2);
    await vault1.connect(guardian).setVaultStateGuard(5);
    expect(await vault1.state()).to.be.equal(5);

    // Reset
    await xChainController.connect(guardian).setActiveVaultsGuard(vaultNumber, 0);
    await vault1.connect(guardian).setVaultStateGuard(0);
  });

  it('Step 1: Game pushes totalDeltaAllocations to xChainController', async function () {
    // Setting a dummy Controller here so transactions later succeeds but doesnt arrive in the correct Controller
    // Will be corrected by the guardian
    await xChainControllerDUMMY.connect(guardian).resetVaultStagesDao(vaultNumber);
    await xChainController.connect(guardian).resetVaultStagesDao(vaultNumber);

    // Should emit event with the allocations from above
    await expect(game.pushAllocationsToController(vaultNumber))
      .to.emit(game, 'PushedAllocationsToController')
      .withArgs(vaultNumber, [400 * 1e6, 100 * 1e6]);

    // Allocations in xChainController should still be 0 cause of the Dummy
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(0);

    await xChainController
      .connect(guardian)
      .receiveAllocationsFromGameGuard(vaultNumber, [400 * 1e6, 100 * 1e6]);

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
      .withArgs(vaultNumber, 10, 400_000 * 1e6, 400_000 * 1e6, 0);

    await expect(vault2.pushTotalUnderlyingToController())
      .to.emit(vault2, 'PushTotalUnderlying')
      .withArgs(vaultNumber, 100, 1000 * 1e6, 1000 * 1e6, 0);

    // should have been send to DUMMY so this should be 0
    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(0);

    // Guardian calls manually
    await Promise.all([
      xChainController
        .connect(guardian)
        .setTotalUnderlyingGuard(vaultNumber, 10, 400_000 * 1e6, 400_000 * 1e6, 0),
      xChainController
        .connect(guardian)
        .setTotalUnderlyingGuard(vaultNumber, 100, 1000 * 1e6, 1000 * 1e6, 0),
    ]);

    expect(await xChainController.getTotalUnderlyingVaultTEST(vaultNumber)).to.be.equal(
      401_000 * 1e6,
    );
    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(401_000 * 1e6);
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 10)).to.be.equal(
      400_000 * 1e6,
    );
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 100)).to.be.equal(
      1000 * 1e6,
    );
  });

  it('Step 3: xChainController pushes exchangeRate amount to send X Chain', async function () {
    const expectedAmounts = [400_000 - (400 / 500) * 401_000, 0];

    // Sending values to dummy vaults
    await expect(xChainControllerDUMMY.pushVaultAmounts(vaultNumber))
      .to.emit(xChainControllerDUMMY, 'SendXChainAmount')
      .withArgs(vault1.address, 10, expectedAmounts[0] * 1e6, 1 * 1e6);

    expect(formatUSDC(await vault1.amountToSendXChain())).to.be.equal(expectedAmounts[0]);
    expect(formatUSDC(await vault2.amountToSendXChain())).to.be.equal(expectedAmounts[1]);

    // Test guardian function
    await vault1.connect(guardian).setXChainAllocationGuard(2000, 1.5 * 1e6);
    await vault2.connect(guardian).setXChainAllocationGuard(1000, 1.5 * 1e6);

    expect(await vault1.amountToSendXChain()).to.be.equal(2000);
    expect(await vault2.amountToSendXChain()).to.be.equal(1000);
    expect(await vault1.exchangeRate()).to.be.equal(1.5 * 1e6);
    expect(await vault2.exchangeRate()).to.be.equal(1.5 * 1e6);

    // set state back for next step
    await vault1.connect(guardian).setXChainAllocationGuard(expectedAmounts[0] * 1e6, 1 * 1e6);
    await vault2.connect(guardian).setXChainAllocationGuard(0, 1 * 1e6);
  });

  it('Step 4: Push funds from vaults to xChainControlle', async function () {
    await vault1.rebalanceXChain();
    await vault2.rebalanceXChain();

    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(0);
    // Manually up funds received because feedback is sent to DUMMY controller
    await xChainController.connect(guardian).setFundsReceivedGuard(vaultNumber, 2);
    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(2);
  });

  it('Step 5: Push funds from xChainController to vaults', async function () {
    expect(await vault2.state()).to.be.equal(3);
    // Manually receiving funds (funds it self or not actually received)
    await vault2.connect(guardian).receiveFundsGuard();

    expect(await vault1.state()).to.be.equal(4);
    expect(await vault2.state()).to.be.equal(4);
  });

  it('Step 6: Game pushes deltaAllocations to vaults', async function () {
    const allocationArray = [100 * 1e6, 0, 200 * 1e6, 300 * 1e6, 400 * 1e6];

    // Manually setting protcol allocations
    await vault1.connect(guardian).receiveProtocolAllocationsGuard(allocationArray);

    for (let i = 0; i < allocationArray.length; i++) {
      expect(await vault1.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[i]);
    }

    expect(await vault1.deltaAllocationsReceived()).to.be.true;
  });

  it('Step 8: Vaults push rewardsPerLockedToken to game', async function () {
    await game.connect(guardian).upRebalancingPeriod(vaultNumber);

    const vault1Rewards = [1 * 1e6, 0, 2 * 1e6, 3 * 1e6, 4 * 1e6];
    const vault2Rewards = [0, 0, 0, 6 * 1e6, 7 * 1e6];

    await game.connect(guardian).settleRewardsGuard(vaultNumber, 10, vault1Rewards);
    await game.connect(guardian).settleRewardsGuard(vaultNumber, 100, vault2Rewards);

    for (let i = 0; i < vault1Rewards.length; i++) {
      expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, 10, 1, i)).to.be.equal(
        vault1Rewards[i],
      );
      expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, 100, 1, i)).to.be.equal(
        vault2Rewards[i],
      );
    }
  });

  it('Both Game and Vault should revert when rebalance not needed', async function () {
    // set very high interval so a rebalance is not needed
    await vault1.connect(guardian).setRebalanceInterval(100_000);
    await game.connect(dao).setRebalanceInterval(100_000);

    await expect(vault1.pushTotalUnderlyingToController()).to.be.revertedWith('Rebalancing');
    await expect(game.pushAllocationsToController(vaultNumber)).to.be.revertedWith(
      'No rebalance needed',
    );
  });
});
