import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import {
  erc20,
  formatEther,
  formatUSDC,
  getSwapDeadline,
  parseDRB,
  parseEther,
  parseUnits,
  parseUSDC,
} from '@testhelp/helpers';
import type { Controller, DerbyToken, GameMock } from '@typechain';
import { usdc } from '@testhelp/addresses';
import { setupIntegration } from './setup';
import { IGameUser, IChainId, mintBasket, IVaultUser, IVaults, IUnderlyingVault } from './helpers';

describe('Testing full integration test', async () => {
  let vaultNumber: BigNumberish = 10,
    guardian: Signer,
    IUSDc: Contract = erc20(usdc),
    vaults: IVaults[],
    underlyingVaults: IUnderlyingVault[],
    controller: Controller,
    game: GameMock,
    derbyToken: DerbyToken,
    vaultUsers: IVaultUser[],
    gameUsers: IGameUser[],
    exchangeRate: number,
    chains: IChainId[];

  before(async function () {
    const setup = await setupIntegration();
    game = setup.game;
    controller = setup.controller;
    derbyToken = setup.derbyToken;
    guardian = setup.guardian;

    chains = [
      {
        id: 10,
        totalAllocations: 500, // * 10^18 (DRB tokens)
      },
      {
        id: 100,
        totalAllocations: 2500, // * 10^18 (DRB tokens)
      },
    ];

    vaultUsers = [
      {
        user: setup.users[0],
        chain: 10,
        vault: setup.vaults[0],
        depositAmount: parseUSDC(10_000),
      },
      {
        user: setup.users[1],
        chain: 10,
        vault: setup.vaults[0],
        depositAmount: parseUSDC(100_000),
      },
      {
        user: setup.users[2],
        chain: 100,
        vault: setup.vaults[1],
        depositAmount: parseUSDC(1_000_000),
      },
    ];

    vaults = [
      {
        // expected stats based on vaultUsers deposits
        vault: setup.vaults[0],
        homeChain: 10,
        underlying: parseUSDC(110_000),
        totalSupply: parseUnits(110_000, 6),
        totalWithdrawalRequests: 0,
      },
      {
        // expected stats based on vaultUsers deposits
        vault: setup.vaults[1],
        homeChain: 100,
        underlying: parseUSDC(1_000_000),
        totalSupply: parseUnits(1_000_000, 6),
        totalWithdrawalRequests: 0,
      },
    ];

    gameUsers = [
      {
        user: setup.gameUsers[0],
        basketId: 0,
        vaultNumber: 10,
        chainId: chains[0].id,
        allocations: [parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100)],
        totalAllocations: 500, // * 10^18
      },
      {
        user: setup.gameUsers[1],
        basketId: 1,
        vaultNumber: 10,
        chainId: chains[1].id,
        allocations: [parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500)],
        totalAllocations: 2500, // * 10^18
      },
    ];

    underlyingVaults = [
      {
        name: 'YearnMockUSDC1',
        vault: setup.underlyingVaults[0],
        price: parseUnits(1.02, 6),
      },
      {
        name: 'YearnMockUSDC2',
        vault: setup.underlyingVaults[1],
        price: parseUnits(1.05, 6),
      },
      {
        name: 'YearnMockUSDC3',
        vault: setup.underlyingVaults[2],
        price: parseUnits(1.1, 6),
      },
      {
        name: 'YearnMockUSDC4',
        vault: setup.underlyingVaults[3],
        price: parseUnits(1.15, 6),
      },
      {
        name: 'YearnMockUSDC5',
        vault: setup.underlyingVaults[4],
        price: parseUnits(1.2, 6),
      },
    ];
  });

  describe('Create and rebalance basket for 2 game users', async function () {
    it('Rebalance basket allocation array for both game users', async function () {
      for (const { basketId, user, chainId, totalAllocations, allocations } of gameUsers) {
        await mintBasket(game, user, chainId, vaultNumber);

        await derbyToken.connect(user).increaseAllowance(game.address, parseDRB(totalAllocations));

        // should still pass since rebalancing Period is 1
        await game.connect(guardian).setRewardsReceived(vaultNumber, chainId, false);

        await expect(() =>
          game.connect(user).rebalanceBasket(basketId, allocations),
        ).to.changeTokenBalance(derbyToken, user, parseDRB(-totalAllocations));

        expect(await game.connect(user).basketTotalAllocatedTokens(basketId)).to.be.equal(
          parseDRB(totalAllocations),
        );
      }
    });

    it('Should set protocol allocations correctly in baskets', async function () {
      // loops through allocations arrays from both baskets
      for (const { user, basketId, allocations } of gameUsers) {
        for (let i = 0; i < allocations.length; i++) {
          expect(
            await game.connect(user).basketAllocationInProtocol(basketId, i),
          ).to.be.equal(allocations[i]);
          expect(
            await game.connect(user).basketAllocationInProtocol(basketId, i),
          ).to.be.equal(allocations[i]);
        }
      }
    });

    it('Should set chain allocations correctly in game contract', async function () {
      for (const chain of chains) {
        expect(await game.getDeltaAllocationsVault(chain.id, vaultNumber)).to.be.equal(
          parseDRB(chain.totalAllocations),
        );
      }
    });

    it('Should set protocol allocations correctly in game contract', async function () {
      // basket allocation arrays added together
      const expectedAllocations = [
        [parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100)],
        [parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500)],
      ];
      for (let i = 0; i < expectedAllocations[0].length; i++) {
        expect(await game.getDeltaAllocationsProtocol(chains[0].id, vaultNumber, i)).to.be.equal(
          expectedAllocations[0][i],
        );
        expect(await game.getDeltaAllocationsProtocol(chains[1].id, vaultNumber, i)).to.be.equal(
          expectedAllocations[1][i],
        );
      }
    });

    it('Game contract should have derbyTokens locked', async function () {
      expect(await derbyToken.balanceOf(game.address)).to.be.equal(
        parseDRB(gameUsers[0].totalAllocations + gameUsers[1].totalAllocations),
      );
    });
  });

  describe('Deposit funds in vaults', async function () {
    it('Deposit funds in vault 1 and 2 for all 3 vault users', async function () {
      for (const { user, vault, depositAmount } of vaultUsers) {
        await vault.connect(user).deposit(depositAmount);
      }

      await vaults[0].vault.upRebalancingPeriodTEST();
      await vaults[1].vault.upRebalancingPeriodTEST();

      for (const { user, vault, depositAmount } of vaultUsers) {
        const expectedLPTokens = depositAmount; // exchangeRate is 1

        await expect(() => vault.connect(user).redeemDeposit()).to.changeTokenBalance(
          vault,
          user,
          expectedLPTokens,
        );
      }
    });
  });

  describe('Rebalance Step: Game pushes deltaAllocations to vaults', async function () {
    // total expected chain allocatioons
    before(function () {
      vaults[0].chainAllocs = [
        parseDRB(100),
        parseDRB(100),
        parseDRB(100),
        parseDRB(100),
        parseDRB(100),
      ];
      vaults[1].chainAllocs = [
        parseDRB(500),
        parseDRB(500),
        parseDRB(500),
        parseDRB(500),
        parseDRB(500),
      ];
    });

    it('Trigger should emit PushProtocolAllocations event', async function () {
      await expect(game.pushAllocationsToVaults(vaults[0].homeChain, vaultNumber))
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[0].homeChain, vaults[0].vault.address, vaults[0].chainAllocs);
      await expect(game.pushAllocationsToVaults(vaults[1].homeChain, vaultNumber))
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[1].homeChain, vaults[1].vault.address, vaults[1].chainAllocs);
    });

    it('Should set protocol allocations in vaults', async function () {
      const id = await controller.latestProtocolId(vaultNumber);

      // looping through expected chain allocations set above for both vaults and compare them
      for (const { vault, chainAllocs } of vaults) {
        for (let i = 0; i < Number(id); i++) {
          expect(await vault.getDeltaAllocationTEST(i)).to.be.equal(chainAllocs![i]);
        }
      }
    });

    it('Should set deltaAllocationsReceived to true in vaults', async function () {
      for (const { vault } of vaults) {
        expect(await vault.deltaAllocationsReceived()).to.be.true;
      }
    });
  });

  describe('Rebalance Step: Vaults rebalance', async function () {
    // expectedProtocolBalance = (allocation / totalAllocations) * totalUnderlying
    before(function () {
      vaults[0].newUnderlying = 110_000; // same as old
      vaults[1].newUnderlying = 1_000_000; // same as old
      vaults[0].expectedProtocolBalance = (600 / 3000) * vaults[0].newUnderlying!;
      vaults[1].expectedProtocolBalance = (1200 / 6000) * vaults[1].newUnderlying!;
    });

    it('Trigger rebalance vaults', async function () {
      for (const { vault } of vaults) {
        await vault.rebalance();
      }
    });

    it('Check savedTotalUnderlying in vaults', async function () {
      for (const { vault, newUnderlying } of vaults) {
        expect(formatUSDC(await vault.savedTotalUnderlying())).to.be.closeTo(newUnderlying, 1500);
      }
    });

    it('Check balance for every protocol in vaults', async function () {
      const id = await controller.latestProtocolId(vaultNumber);

      for (const { vault, expectedProtocolBalance } of vaults) {
        for (let i = 0; i < Number(id); i++) {
          // closeTo because of the stable coin swapping in the vault
          expect(formatUSDC(await vault.balanceUnderlying(i))).to.be.closeTo(
            expectedProtocolBalance,
            1500,
          );
        }
      }
    });
  });

  describe('Rebalance Step: Vaults push rewardsPerLockedToken to game', async function () {
    before(function () {
      // set expectedRewards
      vaults[0].rewards = [0, 0, 0, 0, 0];
      vaults[1].rewards = [0, 0, 0, 0, 0];
    });

    it('Trigger should emit PushedRewardsToGame event', async function () {
      for (const { vault, homeChain, rewards } of vaults) {
        await expect(vault.sendRewardsToGame())
          .to.emit(vault, 'PushedRewardsToGame')
          .withArgs(vaultNumber, homeChain, rewards);
      }
    });

    it('Check rewards for every protocolId', async function () {
      const id = await controller.latestProtocolId(vaultNumber);
      const rebalancingPeriod = 1;

      for (let i = 0; i < Number(id); i++) {
        // rewards are 0 because it is the first rebalance
        expect(
          await game.getRewardsPerLockedTokenTEST(vaultNumber, chains[0].id, rebalancingPeriod, i),
        ).to.be.equal(0);
        expect(
          await game.getRewardsPerLockedTokenTEST(vaultNumber, chains[1].id, rebalancingPeriod, i),
        ).to.be.equal(0);
      }
    });
  });

  describe('Rebalance 2 Step: Game pushes deltaAllocations to vaults, 0 deltas', async function () {
    it('Trigger should emit PushProtocolAllocations event', async function () {
      await expect(game.pushAllocationsToVaults(vaults[0].homeChain, vaultNumber))
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[0].homeChain, vaults[0].vault.address, [0, 0, 0, 0, 0]);
      await expect(game.pushAllocationsToVaults(vaults[1].homeChain, vaultNumber))
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[1].homeChain, vaults[1].vault.address, [0, 0, 0, 0, 0]);
    });
  });

  describe('Rebalance 2 Step: Vaults rebalance', async function () {
    before(async function () {
      underlyingVaults[0].price = parseUnits(1.04, 6);
      underlyingVaults[1].price = parseUnits(1.1, 6);
      underlyingVaults[2].price = parseUnits(1.15, 6);
      underlyingVaults[3].price = parseUnits(1.16, 6);
      underlyingVaults[4].price = parseUnits(1.22, 6);
      for (const { vault, price } of underlyingVaults) {
        await vault.setExchangeRate(price);
        expect(await vault.exchangeRate()).to.be.equal(price);
      }
    });

    it('Trigger rebalance vaults', async function () {
      for (const { vault } of vaults) {
        await vault.rebalance();
      }
    });
  });

  describe('Rebalance 2 Step: Vaults push rewardsPerLockedToken to game', async function () {
    before(function () {
      // set expectedRewards
      vaults[0].rewards = [431_372, 1_047_619, 1_000_000, 191_304, 366_666];
      vaults[1].rewards = [784_313, 1_904761, 1_818_181, 347_826, 666_666];
    });

    it('Trigger should emit PushedRewardsToGame event', async function () {
      for (const { vault, rewards } of vaults) {
        const price = await vault.price(0);
        await expect(vault.sendRewardsToGame())
        .to.emit(vault, 'PushedRewardsToGame');
        // .withArgs(vault.vaultNumber, vault.homeChain, rewards);
      }
    });

    it('Check rewards for every protocolId', async function () {
      const id = await controller.latestProtocolId(vaultNumber);
      const rebalancingPeriod = 3;

      for (let i = 0; i < Number(id); i++) {
        expect(
          formatEther(
            await game.getRewardsPerLockedTokenTEST(
              vaultNumber,
              chains[0].id,
              rebalancingPeriod,
              i,
            ),
          ),
        ).to.be.closeTo(vaults[0].rewards![i], 1);
        expect(
          formatEther(
            await game.getRewardsPerLockedTokenTEST(
              vaultNumber,
              chains[1].id,
              rebalancingPeriod,
              i,
            ),
          ),
        ).to.be.closeTo(vaults[1].rewards![i], 1);
      }
    });
  });

  describe('Game user 0 rebalance to all zero for rewards', async function () {
    // rewardsPerLockedToken * allocations
    const totalExpectedRewards = 303696261;

    before(function () {
      gameUsers[0].allocations = [parseDRB(-100), parseDRB(-100), parseDRB(-100), parseDRB(-100), parseDRB(-100)];

      vaults[0].totalWithdrawalRequests = totalExpectedRewards;
    });

    it('Rebalance basket should give unredeemedRewards', async function () {
      const { user, basketId, allocations } = gameUsers[0];

      // 2 vaults
      expect(await game.getRewardsReceivedTEST(vaultNumber, chains[0].id)).to.be.equal(true);
      expect(await game.getRewardsReceivedTEST(vaultNumber, chains[1].id)).to.be.equal(true);
      await game.connect(user).rebalanceBasket(basketId, allocations);
      expect(await game.connect(user).basketUnredeemedRewards(basketId)).to.be.equal(
        totalExpectedRewards,
      );
    });

    it('Should redeem rewards a.k.a set withdrawalRequest in vault', async function () {
      const { user, basketId } = gameUsers[0];
      await game.connect(user).redeemRewards(basketId);

      expect(await game.connect(user).basketRedeemedRewards(basketId)).to.be.equal(
        totalExpectedRewards,
      );
      expect(await vaults[0].vault.getRewardAllowanceTEST(user.address)).to.be.equal(
        totalExpectedRewards,
      );
      expect(await vaults[0].vault.getTotalWithdrawalRequestsTEST()).to.be.equal(
        totalExpectedRewards,
      );
    });

    it('Should not be able to withdraw rewards from vault before next rebalance', async function () {
      const { user } = gameUsers[0];
      await expect(
        vaults[0].vault.connect(user).withdrawRewards(getSwapDeadline(), 0),
      ).to.be.revertedWith('No funds');
    });
  });

  describe('Set withdrawal requests', async function () {
    exchangeRate = 1024847; 

    it('Vault 0 (user 0): Should set withdrawal request for all LP tokens (10k)', async function () {
      const { user, vault } = vaultUsers[0];
      const initialDeposit = 10_000;
      const expectedUserUSDCBalance = initialDeposit * exchangeRate;

      const userBalance = await vault.balanceOf(user.address);

      expect(userBalance).to.be.equal(parseUSDC(initialDeposit));
      await expect(() => vault.connect(user).withdrawalRequest(userBalance)).to.changeTokenBalance(
        vault,
        user,
        parseUSDC(-initialDeposit),
      );
      expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(
        expectedUserUSDCBalance,
      );
    });

    it('Vault 2 (user 2): Should set withdrawal request for LP tokens (500k)', async function () {
      const { user, vault } = vaultUsers[2];
      const withdrawAmount = 500_000;
      const expectedUserUSDCBalance = withdrawAmount * exchangeRate;

      await expect(() =>
        vault.connect(user).withdrawalRequest(parseUSDC(withdrawAmount)),
      ).to.changeTokenBalance(vault, user, parseUSDC(-withdrawAmount));

      expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(
        expectedUserUSDCBalance,
      );
    });
  });

  describe('Rebalance 3 Step: Game pushes deltaAllocations to vaults', async function () {
    before(function () {
      // game user 0 went to all 0 allocations
      vaults[0].chainAllocs = [
        parseDRB(-100),
        parseDRB(-100),
        parseDRB(-100),
        parseDRB(-100),
        parseDRB(-100),
      ];
      vaults[1].chainAllocs = [
        parseDRB(0),
        parseDRB(0),
        parseDRB(0),
        parseDRB(0),
        parseDRB(0),
      ];

      vaults[0].newUnderlying = 102277.722; // 100k (110k -10k) x exchangeRate before performance fee - rewards
      vaults[0].totalSupply = parseUnits(110_000 - 10_000, 6); // 10k User withdraw
      vaults[0].totalWithdrawalRequests =
        Number(vaults[0].totalWithdrawalRequests) + 10_000 * exchangeRate; // 10k User withdraw

      vaults[1].newUnderlying = 515184.8131; // 500k (1000k - 500k) x exchangeRate before performance fee
      vaults[1].totalSupply = parseUnits(1_000_000 - 500_000, 6); // 500k User withdraw
      vaults[1].totalWithdrawalRequests = 500_000 * exchangeRate; // 500k User withdraw
    });

    it('Trigger should emit PushProtocolAllocations event', async function () {
      await expect(game.pushAllocationsToVaults(vaults[0].homeChain, vaultNumber))
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[0].homeChain, vaults[0].vault.address, vaults[0].chainAllocs);
      await expect(game.pushAllocationsToVaults(vaults[1].homeChain, vaultNumber))
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[1].homeChain, vaults[1].vault.address, vaults[1].chainAllocs);
    });
  });

  describe('Rebalance 3 Step: Vaults rebalance', async function () {
    // totalUnderlying = oldUnderlying - withdrawalRequests
    // expectedProtocolBalance = (allocation / totalAllocations) * totalUnderlying
    before(function () {
      vaults[0].expectedProtocolBalance = 0;
      vaults[1].expectedProtocolBalance = (1 / 5) * vaults[1].newUnderlying!;
    });

    it('Trigger rebalance vaults', async function () {
      const id = await controller.latestProtocolId(vaultNumber);
      for (const { vault } of vaults) {
        await vault.rebalance();
      }
    });

    it('Check balance for every protocol in vaults', async function () {
      const id = await controller.latestProtocolId(vaultNumber);

      for (const { vault, expectedProtocolBalance } of vaults) {
        for (let i = 0; i < Number(id); i++) {
          // closeTo because of the stable coin swapping in the vault
          expect(formatUSDC(await vault.balanceUnderlying(i))).to.be.closeTo(
            expectedProtocolBalance,
            400,
          );
        }
      }
    });
  });

  describe('Rebalance 3 Step: Vaults push rewardsPerLockedToken to game', async function () {
    it('Trigger should emit PushedRewardsToGame event', async function () {
      // 0 rewards made
      const rewards = [0, 0, 0, 0, 0];

      for (const { vault, homeChain } of vaults) {
        await expect(vault.sendRewardsToGame())
          .to.emit(vault, 'PushedRewardsToGame')
          .withArgs(vaultNumber, homeChain, rewards);
      }
    });

    it('Rewards should be the same because they are accumulated', async function () {
      const id = await controller.latestProtocolId(vaultNumber);
      const rebalancingPeriod = 3;

      for (let i = 0; i < Number(id); i++) {
        expect(
          formatEther(
            await game.getRewardsPerLockedTokenTEST(
              vaultNumber,
              chains[0].id,
              rebalancingPeriod,
              i,
            ),
          ),
        ).to.be.closeTo(vaults[0].rewards![i], 1);
        expect(
          formatEther(
            await game.getRewardsPerLockedTokenTEST(
              vaultNumber,
              chains[1].id,
              rebalancingPeriod,
              i,
            ),
          ),
        ).to.be.closeTo(vaults[1].rewards![i], 1);
      }
    });
  });

  describe('Redeem withdraw allowance for users to receive funds', async function () {
    before(function () {
      exchangeRate = 1024847; // Created allowance with old exchangeRate
    });

    it('Vault 0 (user 0): Withdraw allowance', async function () {
      const { user, vault } = vaultUsers[0];
      const initialDeposit = 10_000;
      const expectedUserUSDCBalance = initialDeposit * exchangeRate * 0.9945;

      expect(await vault.connect(user).balanceOf(user.address)).to.be.equal(0);
      await expect(() => vault.connect(user).withdrawAllowance()).to.changeTokenBalance(
        IUSDc,
        user,
        expectedUserUSDCBalance,
      );
      expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(0);
    });

    it('Vault 2 (user 2): Withdraw allowance', async function () {
      const { user, vault } = vaultUsers[2];
      const withdrawAmount = 500_000;
      const expectedUserUSDCBalance = withdrawAmount * exchangeRate * 0.9945;

      const balanceBefore = formatUSDC(await IUSDc.balanceOf(user.address));
      await vault.connect(user).withdrawAllowance();
      const balanceAfter = formatUSDC(await IUSDc.balanceOf(user.address));

      expect(balanceAfter - balanceBefore).to.be.closeTo(expectedUserUSDCBalance / 1e6, 5);

      expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(0);
    });

    it('Should redeem rewards for game user 0', async function () {
      const totalExpectedRewards = 303696261;

      const { user, basketId } = gameUsers[0];
      const { vault } = vaults[0];

      const balanceBefore = formatUSDC(await IUSDc.balanceOf(user.address));
      await vault.connect(user).withdrawRewards(getSwapDeadline(), 0);
      const balanceAfter = formatUSDC(await IUSDc.balanceOf(user.address));

      expect(balanceAfter - balanceBefore).to.be.closeTo(totalExpectedRewards / 1e6, 5);

      expect(await game.connect(user).basketRedeemedRewards(basketId)).to.be.equal(
        totalExpectedRewards,
      );
      expect(await vault.getRewardAllowanceTEST(user.address)).to.be.equal(0);
      expect(await vault.getTotalWithdrawalRequestsTEST()).to.be.equal(0);
    });
  });
});
