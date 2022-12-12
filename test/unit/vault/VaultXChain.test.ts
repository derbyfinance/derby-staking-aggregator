import { deployments, ethers, run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import {
  erc20,
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
import {
  deployConnextHandlerMock,
  deployController,
  deployDerbyToken,
  deployGameMock,
  deployLZEndpointMock,
  deployMainVaultMock,
  deployXChainControllerMock,
  deployXProvider,
} from '@testhelp/deploy';
import { usdc, starterProtocols as protocols } from '@testhelp/addresses';
import { initController, rebalanceETF } from '@testhelp/vaultHelpers';
import AllMockProviders from '@testhelp/allMockProvidersClass';
import allProviders from '@testhelp/allProvidersClass';
import { vaultInfo } from '@testhelp/vaultHelpers';
import {
  getAllSigners,
  getContract,
  getXProviders,
  InitEndpoints,
  InitProviders,
} from '@testhelp/deployHelpers';
import { vaultDeploySettings } from 'deploySettings';

const amount = 100_000;
const chainIds = [10, 100, 1000, 2000];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther((1e8).toString());
const { name, symbol, decimals, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe('Testing XChainController, unit test', async () => {
  let vault: MainVaultMock,
    xChainController: XChainControllerMock,
    user: Signer,
    IUSDc: Contract = erc20(usdc);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  const setupContracts = deployments.createFixture(async (hre) => {
    await deployments.fixture([
      'XChainControllerMock',
      'MainVaultMock',
      'YearnProvider',
      'CompoundProvider',
      'AaveProvider',
      'TruefiProvider',
      'HomoraProvider',
      'IdleProvider',
      'BetaProvider',
      'XProviderMain',
      'XProviderArbi',
      'XProviderOpti',
    ]);

    const [dao, user, guardian] = await getAllSigners(hre);

    const game = (await getContract('GameMock', hre)) as GameMock;
    const controller = (await getContract('Controller', hre)) as Controller;
    const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
    const xChainController = (await getContract(
      'XChainControllerMock',
      hre,
    )) as XChainControllerMock;
    const vault = (await getContract('MainVaultMock', hre)) as MainVaultMock;

    await allProviders.setProviders(hre);
    await AllMockProviders.deployAllMockProviders(dao);
    await transferAndApproveUSDC(vault.address, user, 10_000_000 * 1e6);

    const [xProviderMain, xProviderArbi] = await getXProviders(hre, { xController: 100, game: 10 });
    await InitProviders(dao, [xProviderMain, xProviderArbi]);
    await InitEndpoints(hre, [xProviderMain, xProviderArbi]);

    await xProviderMain.connect(dao).toggleVaultWhitelist(vault.address);

    const basketId = await run('game_mint_basket', { vaultnumber: vaultNumber });

    await run('game_init', { provider: xProviderMain.address });
    await run('vault_init');
    await run('controller_init');
    await run('xcontroller_init');

    await run('game_set_home_vault', { vault: vault.address });
    await run('xcontroller_set_homexprovider', { address: xProviderArbi.address });

    await run('controller_add_vault', { vault: vault.address });
    await run('vault_set_homexprovider', { address: xProviderMain.address });

    await Promise.all([
      xProviderMain.connect(dao).setTrustedRemote(100, xProviderArbi.address),
      xProviderArbi.connect(dao).setTrustedRemote(10, xProviderMain.address),
      //xProviderMain.connect(dao).toggleVaultWhitelist(vault.address),
      //xProviderArbi.connect(dao).toggleVaultWhitelist(vault.address),
      game.connect(guardian).setVaultAddress(vaultNumber, 10, vault.address),
      xChainController.connect(dao).setVaultChainAddress(vaultNumber, 10, vault.address, usdc),
      xChainController.connect(dao).setHomeXProvider(xProviderArbi.address),
    ]);

    // add all protocol vaults to controller
    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(
        controller,
        dao,
        vaultDeploySettings.vaultNumber,
        allProviders,
      );
    }

    return { vault, controller, game, xChainController, dao, user, guardian };
  });

  beforeEach(async function () {
    const setup = await setupContracts();
    vault = setup.vault;
    user = setup.user;
    xChainController = setup.xChainController;
  });

  it('Testing vault rebalanceXChain', async function () {
    // Rebalancing the vault for setup funds in protocols
    await vault.setDeltaAllocationsReceivedTEST(true);
    await vault.connect(user).deposit(amountUSDC);

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40),
      aaveVault.setDeltaAllocation(vault, 60),
      yearnVault.setDeltaAllocation(vault, 20),
    ]);

    await vault.setVaultState(3);
    await rebalanceETF(vault);

    // Testing rebalance X Chain function
    await vault.setVaultState(1);
    await vault.setAmountToSendXChainTEST(amountUSDC.div(2)); // 50k

    await vault.rebalanceXChain();

    const balance = await IUSDc.balanceOf(xChainController.address);
    expect(balance).to.be.equal(amountUSDC.div(2)); // 50k
  });
});
