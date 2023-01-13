import { run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import { erc20, formatUSDC, parseDRB } from '@testhelp/helpers';
import type { DerbyToken, GameMock, MainVaultMock, XChainControllerMock } from '@typechain';
import { usdc } from '@testhelp/addresses';
import { setupIntegration } from './setup';
import { IBasket, mintBasket } from './helpers';

const chainIds = [10, 100];

describe('Testing full integration test', async () => {
  let vaultNumber: BigNumberish = 10,
    vaults: { 1: MainVaultMock; 2: MainVaultMock },
    users: Signer[],
    gameUsers: Signer[],
    baskets: IBasket[],
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

    baskets = [
      {
        gameUser: gameUsers[0],
        basketId: 0,
        allocations: [
          [parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100)],
          [parseDRB(200), parseDRB(200), parseDRB(200), parseDRB(200), parseDRB(200)],
        ],
        totalAllocations: parseDRB(1500),
      },
      {
        gameUser: gameUsers[0],
        basketId: 0,
        allocations: [
          [parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500)],
          [parseDRB(1_000), parseDRB(1_000), parseDRB(1_000), parseDRB(1_000), parseDRB(1_000)],
        ],
        totalAllocations: parseDRB(1700),
      },
    ];
  });

  describe('Create and rebalance basket for 3 game users', async function () {
    it('Rebalance basket allocation array for both game users', async function () {
      for await (const basket of baskets) {
        basket.basketId = await mintBasket(game, basket.gameUser, vaultNumber);

        await derbyToken
          .connect(basket.gameUser)
          .increaseAllowance(game.address, basket.totalAllocations);

        await expect(() =>
          game.connect(basket.gameUser).rebalanceBasket(basket.basketId, basket.allocations),
        ).to.changeTokenBalance(derbyToken, basket.gameUser, -basket.totalAllocations);
      }

      // expect(await game.connect(user[1]).basketTotalAllocatedTokens(gameUserBasket[1])).to.be.equal(
      //   parseDRB(100 * (2 * 5)),
      // );
      // expect(await game.connect(user[2]).basketTotalAllocatedTokens(gameUserBasket[2])).to.be.equal(
      //   parseDRB(500 * (2 * 5)),
      // );
    });

    // it('Rebalance basket allocation array for both game users', async function () {
    //   baskets[0].basketId = await mintBasket(game, gameUsers[0], vaultNumber);
    //   baskets[1].basketId = await mintBasket(game, gameUsers[1], vaultNumber);

    //   baskets.forEach(async (user, i) => {
    //     await derbyToken
    //       .connect(gameUsers[i])
    //       .increaseAllowance(game.address, baskets[i].totalAllocations);

    //     await expect(() =>
    //       game.connect(gameUsers[i]).rebalanceBasket(baskets[i].basketId, baskets[i].allocations),
    //     ).to.changeTokenBalance(derbyToken, user, -baskets[i].totalAllocations);
    //   });

    //   // expect(await game.connect(user[1]).basketTotalAllocatedTokens(gameUserBasket[1])).to.be.equal(
    //   //   parseDRB(100 * (2 * 5)),
    //   // );
    //   // expect(await game.connect(user[2]).basketTotalAllocatedTokens(gameUserBasket[2])).to.be.equal(
    //   //   parseDRB(500 * (2 * 5)),
    //   // );
    // });

    // it('Should set allocations correctly in game contract', async function () {
    //   const test = await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[0]);
    //   const test2 = await game.getDeltaAllocationChainTEST(vaultNumber, chainIds[1]);
    //   console.log({ test });
    //   console.log({ test2 });
    // });
  });
});
