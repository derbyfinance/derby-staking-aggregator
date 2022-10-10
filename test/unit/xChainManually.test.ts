import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { erc20, formatUSDC, getEvent, getUSDCSigner, parseEther, parseUSDC } from '@testhelp/helpers';
import type { ConnextHandlerMock, Controller, DerbyToken, GameMock, LZEndpointMock, MainVaultMock, XChainControllerMock, XProvider } from '@typechain';
import { deployConnextHandlerMock, deployController, deployDerbyToken, deployGameMock, deployLZEndpointMock, deployMainVaultMock, deployXChainControllerMock, deployXProvider } from '@testhelp/deploy';
import { testConnextChainIds, testLayerzeroChainIds, usdc } from "@testhelp/addresses";
import { initController } from "@testhelp/vaultHelpers";
import allProviders  from "@testhelp/allProvidersClass";
import { vaultInfo } from "@testhelp/vaultHelpers";
import { Result } from "ethers/lib/utils";

const { goerli, arbitrumGoerli } = testLayerzeroChainIds;

const amount = 500_000;
const chainIds = [goerli, arbitrumGoerli ];
const nftName = 'DerbyNFT';
const nftSymbol = 'DRBNFT';
const amountUSDC = parseUSDC(amount.toString());
const totalDerbySupply = parseEther(1E8.toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

describe("Testing XChainController, unit test", async () => {
  let vault1: MainVaultMock, vault2: MainVaultMock, controller: Controller, xChainController: XChainControllerMock, xChainControllerDUMMY: XChainControllerMock, xProviderGoerli: XProvider, xProviderArbitrum: XProvider, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string, LZEndpointGoerli: LZEndpointMock, LZEndpointArbitrumGoerli: LZEndpointMock, connextHandler: ConnextHandlerMock, DerbyToken: DerbyToken,  game: GameMock;

  before(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    connextHandler = await deployConnextHandlerMock(dao, daoAddr);

    controller = await deployController(dao, daoAddr);
    xChainController = await deployXChainControllerMock(dao, daoAddr, daoAddr, arbitrumGoerli);
    xChainControllerDUMMY = await deployXChainControllerMock(dao, daoAddr, daoAddr, arbitrumGoerli);

    DerbyToken = await deployDerbyToken(user, name, symbol, totalDerbySupply);
    game = await deployGameMock(user, nftName, nftSymbol, DerbyToken.address, controller.address, daoAddr, controller.address);

    [LZEndpointGoerli, LZEndpointArbitrumGoerli ] = await Promise.all([
      deployLZEndpointMock(dao, goerli),
      deployLZEndpointMock(dao, arbitrumGoerli),
    ]);

    [xProviderGoerli, xProviderArbitrum ] = await Promise.all([
      deployXProvider(dao, LZEndpointGoerli.address, connextHandler.address, daoAddr, game.address, xChainControllerDUMMY.address, goerli),
      deployXProvider(dao, LZEndpointArbitrumGoerli.address, connextHandler.address, daoAddr, game.address, xChainControllerDUMMY.address, arbitrumGoerli),
    ]);

    [vault1, vault2 ] = await Promise.all([
      deployMainVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity,),
      deployMainVaultMock(dao, name, symbol, decimals, ETFname, vaultNumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity),
    ]);

    await Promise.all([
      xProviderGoerli.setXControllerProvider(xProviderArbitrum.address),
      xProviderArbitrum.setXControllerProvider(xProviderArbitrum.address),
      xProviderGoerli.setXControllerChainId(arbitrumGoerli),
      xProviderArbitrum.setXControllerChainId(arbitrumGoerli),
      xProviderGoerli.setGameChainId(goerli),
      xProviderArbitrum.setGameChainId(goerli),
      xProviderGoerli.setTrustedRemote(arbitrumGoerli, xProviderArbitrum.address),
      xProviderArbitrum.setTrustedRemote(goerli, xProviderGoerli.address),
      xProviderGoerli.toggleVaultWhitelist(vault1.address),
      xProviderArbitrum.toggleVaultWhitelist(vault2.address),
      xProviderGoerli.setConnextChainId(goerli, testConnextChainIds.goerli),
      xProviderGoerli.setConnextChainId(arbitrumGoerli, testConnextChainIds.mumbai), // arbitrum not supported
      xProviderArbitrum.setConnextChainId(goerli, testConnextChainIds.goerli),
      xProviderArbitrum.setConnextChainId(arbitrumGoerli, testConnextChainIds.mumbai), // arbitrum not supported
    ]);

    await Promise.all([
      game.connect(dao).setXProvider(xProviderGoerli.address),
      game.connect(dao).setChainIdArray(chainIds),
      game.connect(dao).addETF(vault1.address),
      game.connect(dao).setLatestProtocolId(goerli, 5),
      game.connect(dao).setLatestProtocolId(arbitrumGoerli, 5),
      game.connect(dao).setVaultAddress(vaultNumber, goerli, vault1.address),
      game.connect(dao).setVaultAddress(vaultNumber, arbitrumGoerli, vault2.address),
    ]);

    await Promise.all([
      LZEndpointGoerli.setDestLzEndpoint(xProviderArbitrum.address, LZEndpointArbitrumGoerli.address),
      LZEndpointArbitrumGoerli.setDestLzEndpoint(xProviderGoerli.address, LZEndpointGoerli.address),
    ]);

    await Promise.all([
      initController(controller, [userAddr, game.address, vault1.address, vault2.address ]),
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(5)),
      IUSDc.connect(user).approve(vault1.address, amountUSDC),
      IUSDc.connect(user).approve(vault2.address, amountUSDC.mul(2)),
    ]);

    await Promise.all([
      vault1.setXControllerAddress(xChainControllerDUMMY.address),
      vault2.setXControllerAddress(xChainControllerDUMMY.address),
      vault1.setHomeXProviderAddress(xProviderGoerli.address),
      vault2.setHomeXProviderAddress(xProviderArbitrum.address),
      vault1.setChainIds(goerli),
      vault2.setChainIds(arbitrumGoerli),
    ]);

    await Promise.all([
      xChainController.setVaultChainAddress(vaultNumber, goerli, vault1.address, usdc),
      xChainController.setVaultChainAddress(vaultNumber, arbitrumGoerli, vault2.address, usdc),
      xChainController.setHomeXProviderAddress(xProviderArbitrum.address), // xChainController on chain 100
      xChainController.connect(dao).setChainIdArray(chainIds),
      xChainControllerDUMMY.setVaultChainAddress(vaultNumber, goerli, vault1.address, usdc),
      xChainControllerDUMMY.setVaultChainAddress(vaultNumber, arbitrumGoerli, vault2.address, usdc),
      xChainControllerDUMMY.setHomeXProviderAddress(xProviderArbitrum.address),
      xChainControllerDUMMY.connect(dao).setChainIdArray(chainIds),
    ]);
  });

  it("1) Store allocations in Game contract", async function() {
    await game.mintNewBasket(vaultNumber); 

    const allocationArray = [ 
      [100*1E6, 0, 100*1E6, 100*1E6, 100*1E6], // 400
      [100*1E6, 0, 0, 0, 0], // 100
    ];
    const totalAllocations = 500*1E6;

    await DerbyToken.increaseAllowance(game.address, totalAllocations);
    await game.rebalanceBasket(vaultNumber, allocationArray);

    expect(await game.basketTotalAllocatedTokens(vaultNumber)).to.be.equal(totalAllocations);
  });

  it("Only be called by Guardian", async function() {

  });

  it("Step 1: Game pushes totalDeltaAllocations to xChainController", async function() {
    // Setting a dummy Controller here so transaction below succeeds but doesnt arrive in the correct Controller
    // Will be corrected by the guardian
    await xChainControllerDUMMY.connect(dao).resetVaultStagesDao(vaultNumber);
    await xChainController.connect(dao).resetVaultStagesDao(vaultNumber);

    // Should emit event with the allocations from above
    await expect(game.pushAllocationsToController(vaultNumber))
      .to.emit(game, 'PushedAllocationsToController')
      .withArgs(vaultNumber, [400*1E6, 100*1E6]);

    // Allocations in xChainController should still be 0 cause of the Dummy
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(0);

    await xChainController.receiveAllocationsFromGameGuard(vaultNumber, [400*1E6, 100*1E6]);

    // Checking if allocations are correctly set in xChainController
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(500*1E6);
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[0])).to.be.equal(400*1E6);
  });

  
  it("Step 2: Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests to xChainController", async function() {
    await vault1.connect(user).deposit(400_000*1E6);
    await vault2.connect(user).deposit(1000*1E6);

    await expect(vault1.pushTotalUnderlyingToController())
      .to.emit(vault1, 'PushTotalUnderlying')
      .withArgs(vaultNumber, goerli, 400_000*1E6, 400_000*1E6, 0);

    await expect(vault2.pushTotalUnderlyingToController())
      .to.emit(vault2, 'PushTotalUnderlying')
      .withArgs(vaultNumber, arbitrumGoerli, 1000*1E6, 1000*1E6, 0);

    // should have been send to DUMMY so this should be 0
    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(0);

    // Guardian calls manually
    await Promise.all([
      xChainController.setTotalUnderlyingGuard(vaultNumber, goerli, 400_000*1E6, 400_000*1E6, 0),
      xChainController.setTotalUnderlyingGuard(vaultNumber, arbitrumGoerli, 1000*1E6, 1000*1E6, 0)
    ]);

    expect(await xChainController.getTotalUnderlyingVaultTEST(vaultNumber)).to.be.equal(401_000*1E6);
    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(401_000*1E6);
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, goerli)).to.be.equal(400_000*1E6);
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, arbitrumGoerli)).to.be.equal(1000*1E6);  
  });

});