import { deployments, ethers, run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract, BigNumber, BigNumberish } from 'ethers';
import {
  erc20,
  formatEther,
  getUSDCSigner,
  parseEther,
  parseUSDC,
  random,
} from '@testhelp/helpers';
import type {
  Controller,
  GameMock,
  MainVaultMock,
  DerbyToken,
  XProvider,
  XChainControllerMock,
  LZEndpointMock,
} from '@typechain';
import {
  deployController,
  deployLZEndpointMock,
  deployMainVaultMock,
  deployXChainControllerMock,
  deployXProvider,
} from '@testhelp/deploy';
import { usdc } from '@testhelp/addresses';
import { getAllocations, initController } from '@testhelp/vaultHelpers';
import AllMockProviders from '@testhelp/allMockProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';
import { deployGameMock, deployDerbyToken } from '@testhelp/deploy';
import {
  deployAndGetProviders,
  getAllSigners,
  getContract,
  getDerbyToken,
  getGame,
} from '@testhelp/deployHelpers';
import { derbyTokenSettings, gameInitSettings } from 'deploySettings';

const basketNum = 0;
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amount = 100000;
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther((1e8).toString());
const uniswapToken = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';

describe.only('Testing Game', async () => {
  let vault: MainVaultMock,
    controller: Controller,
    dao: Signer,
    user: Signer,
    USDCSigner: Signer,
    IUSDc: Contract,
    daoAddr: string,
    userAddr: string,
    derbyToken: DerbyToken,
    game: GameMock,
    basketId: BigNumberish,
    vaultNumber: BigNumberish,
    chainIds: BigNumberish[],
    xChainController: XChainControllerMock,
    xProviderMain: XProvider,
    xProviderArbi: XProvider,
    LZEndpoint10: LZEndpointMock,
    LZEndpoint100: LZEndpointMock;

  const setupGame = deployments.createFixture(async (hre) => {
    await deployments.fixture(['XChainControllerMock']);
    game = await getGame(hre); ///////////////////////////////////////////
    derbyToken = await getDerbyToken(hre); /////////////////////////////////////
    xChainController = (await getContract('XChainControllerMock', hre)) as XChainControllerMock;

    console.log(xChainController.address);

    const signers = await getAllSigners(hre);
    dao = signers.dao;
    user = signers.user;
    vaultNumber = random(100);

    await run('game_init');
    await run('xcontroller_init');

    [xProviderMain, xProviderArbi] = await deployAndGetProviders(hre, 100, 10);
  });

  before(async function () {
    await setupGame();

    const amount = 1_000 * 1e6;
    chainIds = gameInitSettings.chainids;
    await derbyToken.transfer(await user.getAddress(), amount);
    await xProviderMain.connect(dao).setTrustedRemote(100, xProviderArbi.address);
    await xProviderArbi.connect(dao).setTrustedRemote(10, xProviderMain.address);

    //   [dao, user] = await ethers.getSigners();

    //   [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
    //     getUSDCSigner(),
    //     erc20(usdc),
    //     dao.getAddress(),
    //     user.getAddress(),
    //   ]);

    //   controller = await deployController(dao, daoAddr);
    //   DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    //   game = await deployGameMock(
    //     user,
    //     nftName,
    //     nftSymbol,
    //     DerbyToken.address,
    //     daoAddr,
    //     daoAddr,
    //     controller.address,
    //   );
    //   vault = await deployMainVaultMock(
    //     dao,
    //     name,
    //     symbol,
    //     decimals,
    //     vaultNumber,
    //     daoAddr,
    //     daoAddr,
    //     game.address,
    //     controller.address,
    //     usdc,
    //     uScale,
    //     gasFeeLiquidity,
    //   );
    //   xChainController = await deployXChainControllerMock(dao, daoAddr, daoAddr, daoAddr, 100);

    //   [LZEndpoint10, LZEndpoint100] = await Promise.all([
    //     deployLZEndpointMock(dao, 10),
    //     deployLZEndpointMock(dao, 100),
    //   ]);

    //   [xProvider10, xProvider100] = await Promise.all([
    //     deployXProvider(
    //       dao,
    //       LZEndpoint10.address,
    //       daoAddr,
    //       daoAddr,
    //       game.address,
    //       xChainController.address,
    //       10,
    //     ),
    //     deployXProvider(
    //       dao,
    //       LZEndpoint100.address,
    //       daoAddr,
    //       daoAddr,
    //       game.address,
    //       xChainController.address,
    //       100,
    //     ),
    //   ]);

    //   await Promise.all([
    //     xProvider10.setXControllerProvider(xProvider100.address),
    //     xProvider10.setXControllerChainId(100),
    //     xProvider100.setXControllerProvider(xProvider100.address),
    //     xProvider100.setXControllerChainId(100),
    //     xProvider10.setXControllerProvider(xProvider100.address),
    //     xProvider100.setXControllerProvider(xProvider100.address),
    //     xProvider10.setGameChainId(10),
    //     xProvider100.setGameChainId(10),
    //     xProvider10.setTrustedRemote(100, xProvider100.address),
    //     xProvider100.setTrustedRemote(10, xProvider10.address),
    //     game.connect(dao).setXProvider(xProvider10.address),
    //   ]);

    //   // With MOCK Providers
    //   await Promise.all([
    //     vault.connect(dao).setSwapRewards(true),
    //     initController(controller, [game.address, vault.address]),
    //     game.connect(dao).setChainIds([10, 100, 1000]),
    //     xChainController.connect(dao).setHomeXProvider(xProvider100.address),
    //     xChainController.connect(dao).setChainIds(chainIds),
    //     AllMockProviders.deployAllMockProviders(dao),
    //     IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
    //     IUSDc.connect(user).approve(vault.address, amountUSDC),
    //   ]);

    //   await Promise.all([
    //     game.connect(dao).setLatestProtocolId(10, 5),
    //     game.connect(dao).setLatestProtocolId(100, 5),
    //     game.connect(dao).setLatestProtocolId(1000, 5),
    //     game.connect(dao).setHomeVault(vault.address),
    //     game.connect(dao).setNegativeRewardThreshold(-50000),
    //     game.connect(dao).setNegativeRewardFactor(50),
    //   ]);

    //   await Promise.all([
    //     LZEndpoint10.setDestLzEndpoint(xProvider100.address, LZEndpoint100.address),
    //     LZEndpoint100.setDestLzEndpoint(xProvider10.address, LZEndpoint10.address),
    //   ]);

    // for (const protocol of protocols.values()) {
    //   await protocol.addProtocolToController(controller, vaultNumber, AllMockProviders);
    // }
  });

  it('DerbyToken should have name, symbol and totalSupply set', async function () {
    //const { derbyToken } = await setupGame();
    const { name, symbol, totalSupply } = derbyTokenSettings;
    expect(await derbyToken.name()).to.be.equal(name);
    expect(await derbyToken.symbol()).to.be.equal(symbol);
    expect(await derbyToken.totalSupply()).to.be.equal(parseEther(totalSupply.toString()));
  });

  it('game should have DerbyToken contract addresses set', async function () {
    //const { game, derbyToken } = await setupGame();
    expect(await game.derbyToken()).to.be.equal(derbyToken.address);
  });

  it('Should Lock tokens, mint basket and set correct deltas', async function () {
    //const { game, derbyToken, dao, user, vaultNumber } = await setupGame();

    basketId = await run('game_mint_basket', { vaultnumber: vaultNumber });

    const allocationArray = [
      [100, 0, 0, 200, 0], // 300
      [100, 0, 200, 100, 200], // 600
      [0, 100, 200, 300, 400], // 1000
    ];
    const totalAllocations = 1900;
    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await expect(game.connect(dao).rebalanceBasket(basketId, allocationArray)).to.be.revertedWith(
      'Game: Not the owner of the basket',
    );

    await expect(() =>
      game.connect(user).rebalanceBasket(basketId, allocationArray),
    ).to.changeTokenBalance(derbyToken, user, -1900);

    expect(
      await game.connect(user).getDeltaAllocationChainTEST(vaultNumber, chainIds[0]),
    ).to.be.equal(300);
    expect(
      await game.connect(user).getDeltaAllocationChainTEST(vaultNumber, chainIds[1]),
    ).to.be.equal(600);
    expect(
      await game.connect(user).getDeltaAllocationChainTEST(vaultNumber, chainIds[2]),
    ).to.be.equal(1000);
    expect(await game.connect(user).basketTotalAllocatedTokens(basketId)).to.be.equal(
      totalAllocations,
    );

    // checking all allocations set in allocationArray above
    const chainId0 = await Promise.all(
      allocationArray[0].map((reward, i) => {
        return game.connect(user).basketAllocationInProtocol(basketId, chainIds[0], i);
      }),
    );
    const chainId1 = await Promise.all(
      allocationArray[1].map((reward, i) => {
        return game.connect(user).basketAllocationInProtocol(basketId, chainIds[1], i);
      }),
    );
    const chainId2 = await Promise.all(
      allocationArray[2].map((reward, i) => {
        return game.connect(user).basketAllocationInProtocol(basketId, chainIds[2], i);
      }),
    );

    expect(chainId0).to.deep.equal(allocationArray[0]);
    expect(chainId1).to.deep.equal(allocationArray[1]);
    expect(chainId2).to.deep.equal(allocationArray[2]);
  });

  it('Should Unlock lokens and read allocations in basket', async function () {
    const allocationDeltaArray = [
      [-100, 0, 0, 0, 0],
      [0, 0, -100, -100, -200],
      [0, 0, -200, -200, -100],
    ];

    const allocationTestArray = [
      [0, 0, 0, 200, 0], // 200
      [100, 0, 100, 0, 0], // 200
      [0, 100, 0, 100, 300], // 500
    ];

    await expect(() =>
      game.connect(user).rebalanceBasket(basketId, allocationDeltaArray),
    ).to.changeTokenBalance(derbyToken, user, 1000);

    expect(
      await game.connect(user).getDeltaAllocationChainTEST(vaultNumber, chainIds[0]),
    ).to.be.equal(200);
    expect(
      await game.connect(user).getDeltaAllocationChainTEST(vaultNumber, chainIds[1]),
    ).to.be.equal(200);
    expect(
      await game.connect(user).getDeltaAllocationChainTEST(vaultNumber, chainIds[2]),
    ).to.be.equal(500);
    expect(await game.connect(user).basketTotalAllocatedTokens(basketId)).to.be.equal(1900 - 1000);

    // looping through all of allocationArray
    allocationTestArray.forEach(async (chainIdArray, i) => {
      for (let j = 0; j < chainIdArray.length; j++) {
        expect(
          await game.connect(user).basketAllocationInProtocol(vaultNumber, chainIds[i], j),
        ).to.be.equal(chainIdArray[j]);
      }
    });
  });

  // Allocations in protocols are not resetted at this point
  it.skip('Should push delta allocations from game to xChainController', async function () {
    await xChainController.connect(dao).resetVaultStagesTEST(vaultNumber);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);
    // chainIds = [10, 100, 1000];
    await game.pushAllocationsToController(vaultNumber);

    // checking of allocations are correctly set in xChainController
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(900);
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[0])).to.be.equal(
      200,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[1])).to.be.equal(
      200,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[2])).to.be.equal(
      500,
    );

    // delta allocations for chain in game should be resetted
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[0])).to.be.equal(0);
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[1])).to.be.equal(0);
    expect(await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[2])).to.be.equal(0);

    // checking vaultStages
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(false);
    expect(await xChainController.getAllocationState(vaultNumber)).to.be.equal(true);

    // should not be able to rebalance when game is xChainRebalancing
    await expect(game.rebalanceBasket(basketId, [[0, 1]])).to.be.revertedWith(
      'Game: vault is xChainRebalancing',
    );

    // reset allocations and state for testing
    await game.setXChainRebalanceState(vaultNumber, false);
    await game.rebalanceBasket(basketId, [
      [0, 0, 0, -200, 0], // 200
      [-100, 0, -100, 0, 0], // 200
      [0, -100, 0, -100, -300], // 500
    ]);
  });

  it.skip('Calculate rewards during rebalance Basket', async function () {
    await mockRewards(game, DerbyToken);

    const newAllocations = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ];
    await game.rebalanceBasket(basketNum, newAllocations);

    // allocations in mockRewards function
    /*
    Rewards * allocation = totalReward
    4000 * 200 = 800_000
    200 * 200 = 40_000
    8_000 * 100 = 800_000
    2_000 * 200 = 400_000
    400 * 100 = 40_000
    200 * 200 = 40_000
    total = 2_120_000
    */
    const rewards = await game.basketUnredeemedRewards(basketNum);
    expect(rewards).to.be.equal(2_120_000); // rebalancing period not correct? CHECK
  });

  it.skip('Should be able to redeem rewards / set rewardAllowance', async function () {
    await game.redeemRewards(basketNum);
    await expect(game.redeemRewards(basketNum)).to.be.revertedWith('Nothing to claim');

    expect(await vault.getRewardAllowanceTEST(userAddr)).to.be.equal(2_120_000);
    expect(await vault.getTotalWithdrawalRequestsTEST()).to.be.equal(2_120_000);
  });

  it.skip('Should redeem and swap rewards to UNI tokens', async function () {
    const IUniswap = erc20(uniswapToken);

    await Promise.all([vault.setDaoToken(uniswapToken), vault.setExchangeRateTEST(parseUSDC('1'))]);

    // Deposit so the vault has funds
    await vault.connect(user).deposit(parseUSDC('10000')); // 10k

    await Promise.all([vault.upRebalancingPeriodTEST(), vault.setReservedFundsTEST(2_120_000)]);
    expect(await vault.getReservedFundsTEST()).to.be.equal(2_120_000);

    // Uniswap token is about $8, so should receive atleast (2_120_000 / 1E6) / 8 = 0.3
    await vault.connect(user).withdrawRewards();
    const balance = formatEther(await IUniswap.balanceOf(userAddr));
    expect(Number(balance)).to.be.greaterThan(0.3);

    // Trying to withdraw again, should revert
    await expect(vault.connect(user).withdrawRewards()).to.be.revertedWith('No allowance');

    expect(await vault.getRewardAllowanceTEST(userAddr)).to.be.equal(0);
    expect(await vault.getReservedFundsTEST()).to.be.equal(0);
  });

  it.skip('Mocking rewards again to test when swappingRewards is false', async function () {
    await mockRewards(game, DerbyToken);

    const newAllocations = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ];
    await game.rebalanceBasket(basketNum, newAllocations);
    await game.redeemRewards(basketNum);

    // double the allocations
    expect(await vault.getRewardAllowanceTEST(userAddr)).to.be.equal(4_240_000);
  });

  it.skip('Should redeem rewards and receive USDC instead of UNI tokens', async function () {
    // Swaprewards to false
    await vault.connect(dao).setSwapRewards(false);

    await Promise.all([vault.upRebalancingPeriodTEST(), vault.setReservedFundsTEST(4_240_000)]);
    expect(await vault.getReservedFundsTEST()).to.be.equal(4_240_000);

    await expect(() => vault.connect(user).withdrawRewards()).to.changeTokenBalance(
      IUSDc,
      user,
      4_240_000,
    );

    expect(await vault.getRewardAllowanceTEST(userAddr)).to.be.equal(0);
    expect(await vault.getReservedFundsTEST()).to.be.equal(0);
  });

  it.skip('Should correctly set dao address', async function () {
    await game.connect(dao).setDao(userAddr);
    expect(await game.getDao()).to.be.equal(userAddr);
  });
});

async function mockRewards(game: GameMock, DerbyToken: DerbyToken) {
  let allocations = [
    [parseEther('200'), parseEther('0'), parseEther('0'), parseEther('200'), parseEther('0')], // 400
    [parseEther('100'), parseEther('0'), parseEther('200'), parseEther('100'), parseEther('200')], // 600
  ];
  const totalAllocations = parseEther('1000');

  await game.upRebalancingPeriod(vaultNumber);
  await Promise.all([
    await game.mockRewards(vaultNumber, chainIds[0], [1, 1, 1, 1, 1]),
    await game.mockRewards(vaultNumber, chainIds[1], [1, 1, 1, 1, 1]),
  ]);

  await DerbyToken.increaseAllowance(game.address, totalAllocations);
  await game.rebalanceBasket(basketNum, allocations);

  // This rebalance should be skipped for the basket
  await game.upRebalancingPeriod(vaultNumber);
  await Promise.all([
    game.mockRewards(vaultNumber, chainIds[0], [2_000, 1_000, 500, 100, 0]),
    game.mockRewards(vaultNumber, chainIds[1], [4_000, 2_000, 1_000, 200, 100]),
  ]);

  await game.upRebalancingPeriod(vaultNumber);
  await Promise.all([
    game.mockRewards(vaultNumber, chainIds[0], [2_000, 1_000, 500, 100, 0]),
    game.mockRewards(vaultNumber, chainIds[1], [4_000, 2_000, 1_000, 200, 100]),
  ]);

  await game.upRebalancingPeriod(vaultNumber);
  await Promise.all([
    game.mockRewards(vaultNumber, chainIds[0], [2_000, 1_000, 500, 100, 0]),
    game.mockRewards(vaultNumber, chainIds[1], [4_000, 2_000, 1_000, 200, 100]),
  ]);
}
