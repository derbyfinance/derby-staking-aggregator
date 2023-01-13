import { run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import { erc20, formatUSDC, parseDRB, parseUSDC } from '@testhelp/helpers';
import type { DerbyToken, GameMock, MainVaultMock, XChainControllerMock } from '@typechain';
import { usdc } from '@testhelp/addresses';
import { setupIntegration } from './setup';
import { IGameUser, IChainId, mintBasket, IVaultUser } from './helpers';

describe('Testing full integration test', async () => {
  let vaultNumber: BigNumberish = 10,
    vaults: { 1: MainVaultMock; 2: MainVaultMock },
    xChainController: XChainControllerMock,
    dao: Signer,
    guardian: Signer,
    IUSDc: Contract = erc20(usdc),
    derbyToken: DerbyToken,
    game: GameMock,
    vaultUsers: IVaultUser[],
    gameUsers: IGameUser[],
    chains: IChainId[];

  before(async function () {
    const setup = await setupIntegration();
    vaults = setup.vaults;
    game = setup.game;
    xChainController = setup.xChainController;
    derbyToken = setup.derbyToken;
    dao = setup.dao;
    guardian = setup.guardian;

    chains = [
      {
        id: 10,
        totalAllocations: 3000, // * 10^18
      },
      {
        id: 100,
        totalAllocations: 6000, // * 10^18
      },
    ];

    vaultUsers = [
      {
        user: setup.users[0],
        chain: 10,
        vault: vaults[1],
        depositAmount: parseUSDC(10_000),
      },
      {
        user: setup.users[1],
        chain: 10,
        vault: vaults[1],
        depositAmount: parseUSDC(100_000),
      },
      {
        user: setup.users[2],
        chain: 100,
        vault: vaults[2],
        depositAmount: parseUSDC(1_000_000),
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
    it('Should emit correct event', async function () {
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
        expect(await game.getDeltaAllocationChainTEST(vaultNumber, chain.id)).to.be.equal(10);
        expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chain.id)).to.be.equal(
          parseDRB(chain.totalAllocations),
        );
      }
    });
  });
});
