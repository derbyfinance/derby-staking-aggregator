/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet, utils, Contract } from "ethers";
import { ethers, waffle } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, ERC20, Router } from '../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployAaveProvider, deployRouter, deployETFVaultMock } from './helpers/deploy';
import { getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc} from "./helpers/addresses";

const name = 'XaverUSDC';
const symbol = 'xUSDC';
const decimals = 6;
const amountUSDC = parseUSDC('100000');
const threshold = parseUSDC('0');
const ETFNumber = 1;
let protocolYearn = [1, 20];
let protocolCompound = [2, 40];
let protocolAave = [5, 60];
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, router: Router, dao: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, user: Signer, userAddr: string, vaultMock: ETFVaultMock;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress();
    router = await deployRouter(dao, daoAddr);

    // Deploy vault and all providers
    [vaultMock, yearnProvider, compoundProvider, aaveProvider, USDCSigner, IUSDc] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, ETFNumber, router.address, usdc, threshold),
      deployYearnProvider(dao, yusdc, usdc, router.address),
      deployCompoundProvider(dao, cusdc, usdc, router.address),
      deployAaveProvider(dao, ausdc, router.address),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(2)),
      router.addProtocol(ETFNumber, protocolYearn[0], yearnProvider.address, vaultMock.address),
      router.addProtocol(ETFNumber, protocolCompound[0], compoundProvider.address, vaultMock.address),
      router.addProtocol(ETFNumber, protocolAave[0], aaveProvider.address, vaultMock.address)
    ]);
  });

  it("Should have a name and symbol", async function() {
    expect(await vaultMock.name()).to.be.equal(name);
    expect(await vaultMock.symbol()).to.be.equal(symbol);
    expect(await vaultMock.decimals()).to.be.equal(decimals);
  });

  it("Should set delta allocations", async function() {
    await setDeltaAllocations(vaultMock, allProtocols);

    const [yearn, compound, aave] = await Promise.all([
      vaultMock.getDeltaAllocationTEST(protocolYearn[0]),
      vaultMock.getDeltaAllocationTEST(protocolCompound[0]),
      vaultMock.getDeltaAllocationTEST(protocolAave[0])
    ]);

    expect(yearn).to.be.equal(protocolYearn[1]);
    expect(compound).to.be.equal(protocolCompound[1]);
    expect(aave).to.be.equal(protocolAave[1]);
  });

  it("Should deposit and rebalance", async function() {
    console.log('--------------depositing and rebalance with 100k ----------------')
    await setDeltaAllocations(vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();

    const balances = await getAndLogBalances(vaultMock, allProtocols);
    const allocations = await getAllocations(vaultMock, allProtocols);
    const totalAllocatedTokens = await vaultMock.totalAllocatedTokens();

    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances[i].div(1E6))
      .to.be.closeTo(allocations[i].mul(amountUSDC).div(totalAllocatedTokens).div(1E6), 5)
    })

    console.log('--------------rebalancing with amount 0----------------')
    protocolYearn = [1, 40];
    protocolCompound = [2, -20];
    protocolAave = [5, -20];
    allProtocols = [protocolYearn, protocolCompound, protocolAave];

    await setDeltaAllocations(vaultMock, allProtocols);

    await vaultMock.rebalanceETF();

    const balances2 = await getAndLogBalances(vaultMock, allProtocols);
    const allocations2 = await getAllocations(vaultMock, allProtocols);
    const totalAllocatedTokens2 = await vaultMock.totalAllocatedTokens();

    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances2[i].div(1E6))
      .to.be.closeTo(allocations2[i].mul(amountUSDC).div(totalAllocatedTokens2).div(1E6), 5)
    })

    console.log('--------------rebalancing with amount 50k and Yearn to 0 ----------------')
    protocolYearn = [1, -60]; // to 0
    protocolCompound = [2, 80];
    protocolAave = [5, 40];
    allProtocols = [protocolYearn, protocolCompound, protocolAave];
    const amountToDeposit = parseUSDC('50000');
    const totalAmountDeposited = amountUSDC.add(amountToDeposit);

    await setDeltaAllocations(vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountToDeposit);
    await vaultMock.rebalanceETF();

    const balances3 = await getAndLogBalances(vaultMock, allProtocols);
    const allocations3 = await getAllocations(vaultMock, allProtocols);
    const totalAllocatedTokens3 = await vaultMock.totalAllocatedTokens();

    // Check if balanceInProtocol === currentAllocation / totalAllocated * totalAmountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances3[i].div(1E6))
      .to.be.closeTo(allocations3[i].mul(totalAmountDeposited).div(totalAllocatedTokens3).div(1E6), 5)
    })
  });

});

