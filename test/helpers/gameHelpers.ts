/* eslint-disable prettier/prettier */
// async function generateUnredeemedRewards() {
//   const {yearnProvider, compoundProvider, aaveProvider} = AllMockProviders;

//   // minting
//   await gameMock.connect(dao).addETF(vault.address);
//   await gameMock.mintNewBasket(0);

//   // set liquidity vault to 0 for easy calculation
//   await vault.setLiquidityPerc(0);

//   const amount = 10_000;
//   const amountUSDC = parseUSDC(amount.toString());

//   // set balance before
//   let balance = 1000*1E6;
//   let balanceComp = 1000*1E8;
//   let price = 1000;
//   await Promise.all([
//     yearnProvider.mock.balanceUnderlying.returns(balance),
//     compoundProvider.mock.balanceUnderlying.returns(balanceComp),
//     aaveProvider.mock.balanceUnderlying.returns(balance),
//     yearnProvider.mock.deposit.returns(0),
//     compoundProvider.mock.deposit.returns(0),
//     aaveProvider.mock.deposit.returns(0),
//     yearnProvider.mock.withdraw.returns(0),
//     compoundProvider.mock.withdraw.returns(0),
//     aaveProvider.mock.withdraw.returns(0),
//     yearnProvider.mock.exchangeRate.returns(price),
//     compoundProvider.mock.exchangeRate.returns(price),
//     aaveProvider.mock.exchangeRate.returns(price),
//   ]);

//   // set some initial allocations in the basket
//   let allocations = [10, 0, 10, 0, 10];
//   await xaverToken.increaseAllowance(gameMock.address, 30);
//   await gameMock.rebalanceBasket(0, allocations);

//   // do 3 loops to simulate time passing (and bump up rebalancingperiod).
//   for (let i = 0; i < 3; i++){
//     await Promise.all([
//       compoundVault.setDeltaAllocationsWithGame(gameMock, vault.address, 40),
//       aaveVault.setDeltaAllocationsWithGame(gameMock, vault.address, 60),
//       yearnVault.setDeltaAllocationsWithGame(gameMock, vault.address, 20),
//       compoundDAIVault.setDeltaAllocationsWithGame(gameMock, vault.address, 0),
//       aaveUSDTVault.setDeltaAllocationsWithGame(gameMock, vault.address, 0),
//     ]);

//     // await setDeltaAllocationsWithGame(vault, gameMock, allProtocols);
//     await vault.connect(user).deposit(amountUSDC);

//     // set balance after
//     price = Math.round(price * 1.1);
//     await Promise.all([
//       yearnProvider.mock.exchangeRate.returns(price),
//       compoundProvider.mock.exchangeRate.returns(price),
//       aaveProvider.mock.exchangeRate.returns(price),
//     ]);
//     await vault.setVaultState(3);
//     await rebalanceETF(vault);
//   }

//   // set new allocations in basket
//   let newAllocations = [20, 0, 20, 0, 20]; // not actually stored in vault because we didn't rebalance the vault here
//   await xaverToken.increaseAllowance(gameMock.address, 50);
//   await gameMock.rebalanceBasket(0, newAllocations);

//   // yield per time step: 0.1
//   // started counting basket rewards at rebalancingPeriod 1
//   // end counting basket rewards at rebalancingPeriod 3
//   // 1: rewards: 0
//   // 2: TVL: 10k + 10k +3k = 23k, y: 0.1, perfFee: 0.1, totalTokens: 30 + 120 + 120 = 270, allocations user per protocol: 10
//   // 2: rewards = 23000 * 1E6 * 0.1 * 0.1 / 270 * 10 = 8518518 per game player, 3 players total --> 25555554
//   // 3: rewards = 25555554
//   // total expected rewards = 2 * 25555554 = 51111108
//   let rewards = await gameMock.basketUnredeemedRewards(0);
//   return rewards;
// }
