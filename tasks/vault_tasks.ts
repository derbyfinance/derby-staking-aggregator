import { vaultInitSettings } from 'deploySettings';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('vault_init', 'Initializes the vault').setAction(async (args, { run, getNamedAccounts }) => {
  const { guardian } = await getNamedAccounts();
  const { gasFeeLiq, rebalanceInterval, marginScale, liquidityPercentage, performanceFee } =
    vaultInitSettings;

  await run('vault_set_guardian', { guardian: guardian });

  await Promise.all([
    run('vault_set_gas_fee_liq', { liquidity: gasFeeLiq }),
    run('vault_set_rebalance_interval', { timestamp: rebalanceInterval }),
    run('vault_set_margin_scale', { scale: marginScale }),
    run('vault_set_liquidity_perc', { percentage: liquidityPercentage }),
    run('vault_set_performance_fee', { percentage: performanceFee }),
  ]);
});

/*************
CrossChain
**************/
// not tested yet
task(
  'vault_push_total_underlying',
  'Step 2: Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests',
).setAction(async (_, hre) => {
  const vault = await getVault(hre);
  await vault.pushTotalUnderlyingToController();
});
// not tested yet
task('vault_rebalance_xchain', 'Step 4; Push funds from vaults to xChainController').setAction(
  async (_, hre) => {
    const vault = await getVault(hre);
    await vault.rebalanceXChain();
  },
);
// not tested yet
task('vault_send_rewards_game', 'Step 8; Vaults push rewardsPerLockedToken to game').setAction(
  async (_, hre) => {
    const vault = await getVault(hre);
    await vault.sendRewardsToGame();
  },
);
// not tested yet
task('vault_rebalance_vault', 'Step 7 trigger, end; Vaults rebalance').setAction(async (_, hre) => {
  const vault = await getVault(hre);
  await vault.rebalanceETF();
});
// not tested yet
task(
  'vault_set_totalunderlying',
  'Set total balance in VaultCurrency in all underlying protocols',
).setAction(async (_, hre) => {
  const vault = await getVault(hre);
  await vault.setTotalUnderlying();
});
// not tested yet
task('vault_claim_tokens', 'Harvest extra tokens from underlying protocols').setAction(
  async (_, hre) => {
    const vault = await getVault(hre);
    await vault.claimTokens();
  },
);

/*************
onlyGuardian
**************/
// Not tested yet
task('vault_set_xchain_allocation', 'Step 3: Guardian function')
  .addParam('amount', 'XChain amount to send back', null, types.int)
  .addParam('exchangerate', 'new exchangerate for vault', null, types.int)
  .setAction(async ({ amount, exchangerate }, hre) => {
    const vault = await getVault(hre);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setXChainAllocationGuard(amount, exchangerate);
  });
// Not tested yet
task('vault_receive_funds', 'Step 5: Guardian function').setAction(async (_, hre) => {
  const vault = await getVault(hre);
  const guardian = await getGuardian(hre);
  await vault.connect(guardian).receiveFundsGuard();
});
// Not tested yet
task('vault_receive_protocol_allocations', 'Step 6: Guardian function')
  .addVariadicPositionalParam('deltas', 'Number of chain id set in chainIds array', [], types.int)
  .setAction(async ({ deltas }, hre) => {
    const vault = await getVault(hre);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).receiveProtocolAllocationsGuard(deltas);
  });

task('vault_set_state', 'Guardian function to set state when vault gets stuck')
  .addParam('state', 'state of the vault', null, types.int)
  .setAction(async ({ state }, hre) => {
    const vault = await getVault(hre);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setVaultStateGuard(state);
  });

task('vault_set_home_chain', 'Setter for new homeChain Id')
  .addParam('chainid', 'new homeChain id', null, types.int)
  .setAction(async ({ chainid }, hre) => {
    const vault = await getVault(hre);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setHomeChain(chainid);
  });

task('vault_set_gas_fee_liq', 'Liquidity in vaultcurrency which always should be kept in vault')
  .addParam('liquidity', 'New gas fee liquidity', null, types.int)
  .setAction(async ({ liquidity }, hre) => {
    const vault = await getVault(hre);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setGasFeeLiquidity(liquidity);
  });

task('vault_set_rebalance_interval', 'Set minimum interval for the rebalance function')
  .addParam('timestamp', 'UNIX timestamp', null, types.int)
  .setAction(async ({ timestamp }, hre) => {
    const vault = await getVault(hre);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setRebalanceInterval(timestamp);
  });
// not tested yet
task('vault_blacklist_protocol', 'Blacklist a protolNumber')
  .addParam('protocol', 'Protocol number', null, types.int)
  .setAction(async ({ protocol }, hre) => {
    const vault = await getVault(hre);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).blacklistProtocol(protocol);
  });

task('vault_set_margin_scale', 'Set the marginScale')
  .addParam('scale', 'New margin scale', null, types.int)
  .setAction(async ({ scale }, hre) => {
    const vault = await getVault(hre);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setMarginScale(scale);
  });

task(
  'vault_set_liquidity_perc',
  'Amount of liquidity which should be held in the vault after rebalancing',
)
  .addParam('percentage', 'New margin scale', null, types.int)
  .setAction(async ({ percentage }, hre) => {
    const vault = await getVault(hre);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setLiquidityPerc(percentage);
  });

/*************
OnlyDao
**************/

task('vault_set_homexprovider', 'Setter for xProvider address')
  .addParam('address', 'New provider address')
  .setAction(async ({ address }, hre) => {
    const vault = await getVault(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setHomeXProvider(address);
  });

task('vault_set_dao_token', 'Setter for derby token address')
  .addParam('address', 'New token address')
  .setAction(async ({ address }, hre) => {
    const vault = await getVault(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setDaoToken(address);
  });

task('vault_set_game', 'Setter for game address')
  .addParam('address', 'New game address')
  .setAction(async ({ address }, hre) => {
    const vault = await getVault(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setGame(address);
  });

task('vault_set_swap_rewards', 'Setter for swapping rewards to derby tokens')
  .addParam('state', 'True when rewards should be swapped to derby tokens', null, types.boolean)
  .setAction(async ({ state }, hre) => {
    const vault = await getVault(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setSwapRewards(state);
  });

task('vault_set_dao', 'Setter for dao address')
  .addParam('address', 'New dao address')
  .setAction(async ({ address }, hre) => {
    const vault = await getVault(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setDao(address);
  });

task('vault_set_guardian', 'Setter for guardian address')
  .addParam('guardian', 'New guardian address')
  .setAction(async ({ guardian }, hre) => {
    const vault = await getVault(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setGuardian(guardian);
  });

task('vault_set_performance_fee', 'Setter for performance fee that goes to players')
  .addParam('percentage', 'percentage of the yield that goes to the game players', null, types.int)
  .setAction(async ({ percentage }, hre) => {
    const vault = await getVault(hre);
    const dao = await getDao(hre);
    await vault.connect(dao).setPerformanceFee(percentage);
  });

const getVault = async ({ deployments, ethers, network }: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const vaultContract = network.name === 'hardhat' ? 'MainVaultMock' : 'MainVault';
  const { address } = await deployments.get(vaultContract);
  const vault = await ethers.getContractAt(vaultContract, address);
  return vault;
};

const getDao = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { dao } = await getNamedAccounts();
  return ethers.getSigner(dao);
};

const getGuardian = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { guardian } = await getNamedAccounts();
  return ethers.getSigner(guardian);
};
