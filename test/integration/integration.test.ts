import { run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import { erc20, formatUSDC, parseDRB, parseUnits, parseUSDC } from '@testhelp/helpers';
import type { DerbyToken, GameMock, MainVaultMock, XChainControllerMock } from '@typechain';
import { usdc } from '@testhelp/addresses';
import { setupIntegration } from './setup';
import { IGameUser, IChainId, mintBasket, IVaultUser, IVaults } from './helpers';

describe('Testing full integration test', async () => {
  let vaultNumber: BigNumberish = 10,
    dao: Signer,
    guardian: Signer,
    IUSDc: Contract = erc20(usdc),
    vaults: IVaults[],
    xChainController: XChainControllerMock,
    game: GameMock,
    derbyToken: DerbyToken,
    vaultUsers: IVaultUser[],
    gameUsers: IGameUser[],
    chains: IChainId[];

  before(async function () {
    const setup = await setupIntegration();
    game = setup.game;
    xChainController = setup.xChainController;
    derbyToken = setup.derbyToken;
    dao = setup.dao;
    guardian = setup.guardian;

    chains = [
      {
        id: 10,
        totalAllocations: 3000, // * 10^18 (DRB tokens)
      },
      {
        id: 100,
        totalAllocations: 6000, // * 10^18 (DRB tokens)
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
        // based on vaultUsers deposits
        vault: setup.vaults[0],
        homeChain: 10,
        underlying: parseUSDC(110_000),
        totalSupply: parseUnits(110_000, 6),
        totalWithdrawalRequests: 0,
      },
      {
        // based on vaultUsers deposits
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
        allocations: [
          [parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100)],
          [parseDRB(200), parseDRB(200), parseDRB(200), parseDRB(200), parseDRB(200)],
        ],
        totalAllocations: 1500, // * 10^18
      },
      {
        user: setup.gameUsers[1],
        basketId: 1,
        allocations: [
          [parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500)],
          [parseDRB(1_000), parseDRB(1_000), parseDRB(1_000), parseDRB(1_000), parseDRB(1_000)],
        ],
        totalAllocations: 7500, // * 10^18
      },
    ];
  });

  describe('Create and rebalance basket for 2 game users', async function () {
    it('Rebalance basket allocation array for both game users', async function () {
      for (const { basketId, user, totalAllocations, allocations } of gameUsers) {
        await mintBasket(game, user, vaultNumber);

        await derbyToken.connect(user).increaseAllowance(game.address, parseDRB(totalAllocations));

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
        for (let i = 0; i < allocations[0].length; i++) {
          expect(
            await game.connect(user).basketAllocationInProtocol(basketId, chains[0].id, i),
          ).to.be.equal(allocations[0][i]);
          expect(
            await game.connect(user).basketAllocationInProtocol(basketId, chains[1].id, i),
          ).to.be.equal(allocations[1][i]);
        }
      }
    });

    it('Should set chain allocations correctly in game contract', async function () {
      for (const chain of chains) {
        expect(await game.getDeltaAllocationChainTEST(vaultNumber, chain.id)).to.be.equal(
          parseDRB(chain.totalAllocations),
        );
      }
    });

    it('Should set protocol allocations correctly in game contract', async function () {
      // basket allocation arrays added together
      const expectedAllocations = [
        [parseDRB(600), parseDRB(600), parseDRB(600), parseDRB(600), parseDRB(600)],
        [parseDRB(1200), parseDRB(1200), parseDRB(1200), parseDRB(1200), parseDRB(1200)],
      ];
      for (let i = 0; i < expectedAllocations[0].length; i++) {
        expect(await game.getDeltaAllocationProtocolTEST(vaultNumber, chains[0].id, i)).to.be.equal(
          expectedAllocations[0][i],
        );
        expect(await game.getDeltaAllocationProtocolTEST(vaultNumber, chains[1].id, i)).to.be.equal(
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
        const expectedLPTokens = depositAmount; // exchangeRate is 1

        await expect(() => vault.connect(user).deposit(depositAmount)).to.changeTokenBalance(
          vault,
          user,
          expectedLPTokens,
        );
      }
    });
  });

  describe('Rebalance Step 1: Game pushes allocations to controller', async function () {
    it('Trigger should emit PushedAllocationsToController event', async function () {
      await xChainController.connect(guardian).resetVaultStagesDao(vaultNumber);

      await expect(game.pushAllocationsToController(vaultNumber))
        .to.emit(game, 'PushedAllocationsToController')
        .withArgs(vaultNumber, [
          parseDRB(chains[0].totalAllocations),
          parseDRB(chains[1].totalAllocations),
        ]);
    });

    it('Should have moved delta allocations from game to xChainController', async function () {
      for (const chain of chains) {
        expect(await game.getDeltaAllocationChainTEST(vaultNumber, chain.id)).to.be.equal(0);
        expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chain.id)).to.be.equal(
          parseDRB(chain.totalAllocations),
        );
      }
    });
  });

  describe('Rebalance Step 2: Trigger vaults to push totalUnderlyings', async function () {
    it('Trigger should emit PushTotalUnderlying event', async function () {
      for (const { vault, homeChain, underlying, totalSupply, totalWithdrawalRequests } of vaults) {
        await expect(vault.pushTotalUnderlyingToController())
          .to.emit(vault, 'PushTotalUnderlying')
          .withArgs(vaultNumber, homeChain, underlying, totalSupply, totalWithdrawalRequests);
      }
    });

    it('Should set totalUnderlying correctly in xChainController', async function () {
      for (const { homeChain, underlying } of vaults) {
        expect(
          await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, homeChain),
        ).to.be.equal(underlying);
      }

      expect(await xChainController.getTotalUnderlyingVaultTEST(vaultNumber)).to.be.equal(
        parseUSDC(1_110_000), // 1m + 110k
      );
    });
  });
});
