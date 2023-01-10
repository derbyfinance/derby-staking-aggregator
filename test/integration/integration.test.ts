import { run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import { erc20, formatUSDC, parseDRB } from '@testhelp/helpers';
import type { DerbyToken, GameMock, MainVaultMock, XChainControllerMock } from '@typechain';
import { usdc } from '@testhelp/addresses';
import { setupIntegration } from './setup';
import { mintBasket } from './helpers';

const chainIds = [10, 100, 1000, 10000];

describe.only('Testing full integration test', async () => {
  let vaultNumber: BigNumberish = 10,
    vaults: { 1: MainVaultMock; 2: MainVaultMock; 3: MainVaultMock; 4: MainVaultMock },
    user: { 1: Signer; 2: Signer; 3: Signer },
    gameUser: { 1: Signer; 2: Signer; 3: Signer },
    gameUserBasket: { 1: number; 2: number; 3: number } = { 1: 0, 2: 0, 3: 0 },
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
    user = setup.users;
    gameUser = setup.gameUsers;
  });

  it('Rebalance basket for all 3 game users', async function () {
    gameUserBasket[1] = await mintBasket(game, user[1], vaultNumber);
    gameUserBasket[2] = await mintBasket(game, user[2], vaultNumber);
    gameUserBasket[3] = await mintBasket(game, user[3], vaultNumber);
    await rebalanceBasket(game, derbyToken, user[1], gameUserBasket[1], 100);
    await rebalanceBasket(game, derbyToken, user[2], gameUserBasket[2], 500);
    await rebalanceBasket(game, derbyToken, user[3], gameUserBasket[3], 2_000);
  });
});

async function rebalanceBasket(
  game: GameMock,
  derbyToken: DerbyToken,
  user: Signer,
  basket: number,
  allocation: number,
) {
  const allocationArray = Array.from({ length: 4 }, () =>
    Array.from({ length: 5 }, () => parseDRB(allocation)),
  );
  const totalAllocations = parseDRB(20 * allocation);

  await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);

  await expect(() =>
    game.connect(user).rebalanceBasket(basket, allocationArray),
  ).to.changeTokenBalance(derbyToken, user, parseDRB(-20 * allocation));

  expect(await game.connect(user).basketTotalAllocatedTokens(basket)).to.be.equal(totalAllocations);
}
