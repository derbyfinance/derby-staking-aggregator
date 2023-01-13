import { run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import { erc20, formatUSDC, parseDRB } from '@testhelp/helpers';
import type { DerbyToken, GameMock, MainVaultMock, XChainControllerMock } from '@typechain';
import { usdc } from '@testhelp/addresses';
import { setupIntegration } from './setup';
import { IBasket, IChainId, mintBasket } from './helpers';

describe('Testing full integration test', async () => {
  let vaultNumber: BigNumberish = 10,
    vaults: { 1: MainVaultMock; 2: MainVaultMock },
    users: Signer[],
    gameUsers: Signer[],
    baskets: IBasket[],
    chains: IChainId[],
    xChainController: XChainControllerMock,
    dao: Signer,
    guardian: Signer,
    IUSDc: Contract = erc20(usdc),
    derbyToken: DerbyToken,
    game: GameMock;

  before(async function () {
    const setup = await setupIntegration();
    vaults = setup.vaults;
    game = setup.game;
    xChainController = setup.xChainController;
    derbyToken = setup.derbyToken;
    dao = setup.dao;
    guardian = setup.guardian;
    users = setup.users;
    gameUsers = setup.gameUsers;

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

    baskets = [
      {
        gameUser: gameUsers[0],
        basketId: 0,
        allocations: [
          [parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100)],
          [parseDRB(200), parseDRB(200), parseDRB(200), parseDRB(200), parseDRB(200)],
        ],
        totalAllocations: 1500, // * 10^18
      },
      {
        gameUser: gameUsers[1],
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
      for await (let { basketId, gameUser, totalAllocations, allocations } of baskets) {
        basketId = await mintBasket(game, gameUser, vaultNumber);

        await derbyToken
          .connect(gameUser)
          .increaseAllowance(game.address, parseDRB(totalAllocations));

        await expect(() =>
          game.connect(gameUser).rebalanceBasket(basketId, allocations),
        ).to.changeTokenBalance(derbyToken, gameUser, parseDRB(-totalAllocations));

        expect(await game.connect(gameUser).basketTotalAllocatedTokens(basketId)).to.be.equal(
          parseDRB(totalAllocations),
        );
      }
    });

    it('Should set protocol allocations correctly in baskets', async function () {
      // loops through allocations arrays from both baskets
      for await (const { gameUser, basketId, allocations } of baskets) {
        for (let i = 0; i < allocations[0].length; i++) {
          expect(
            await game.connect(gameUser).basketAllocationInProtocol(basketId, chains[0].id, i),
          ).to.be.equal(allocations[0][i]);
          expect(
            await game.connect(gameUser).basketAllocationInProtocol(basketId, chains[1].id, i),
          ).to.be.equal(allocations[1][i]);
        }
      }
    });

    it('Should set chain allocations correctly in game contract', async function () {
      for await (const chain of chains) {
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
        parseDRB(baskets[0].totalAllocations + baskets[1].totalAllocations),
      );
    });
  });
});
