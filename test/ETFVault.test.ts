/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet, utils, Contract } from "ethers";
import { ethers, waffle } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, ERC20, Router } from '../typechain-types';
import { deployYearnProvider, deployCompoundProvider, deployAaveProvider, deployRouter, deployETFVaultMock } from './helpers/deploy';
import { addProtocolsToRouter, deployAllProviders, getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc} from "./helpers/addresses";

const name = 'XaverUSDC';
const symbol = 'xUSDC';
const decimals = 6;
const amountUSDC = parseUSDC('100000');
const threshold = parseUSDC('0');
const ETFNumber = 1;
let protocolYearn = { number: 1, allocation: 20, address: yusdc };
let protocolCompound = { number: 2, allocation: 40, address: cusdc };
let protocolAave = { number: 5, allocation: 60, address: ausdc };
let allProtocols = [protocolYearn, protocolCompound, protocolAave];

describe("Deploy Contracts and interact with Vault", async () => {
  let yearnProvider: YearnProvider, compoundProvider: CompoundProvider, aaveProvider: AaveProvider, router: Router, dao: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, user: Signer, userAddr: string, vaultMock: ETFVaultMock;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();
    daoAddr = await dao.getAddress();
    userAddr = await user.getAddress();
    router = await deployRouter(dao, daoAddr);

    // Deploy vault and all providers
    [vaultMock, [yearnProvider, compoundProvider, aaveProvider], USDCSigner, IUSDc] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, ETFNumber, router.address, usdc, threshold),
      deployAllProviders(dao, router, allProtocols),
      getUSDCSigner(),
      erc20(usdc),
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC.mul(2)),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC.mul(2)),
      addProtocolsToRouter(ETFNumber, router, vaultMock.address, allProtocols, [yearnProvider, compoundProvider, aaveProvider])
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
      vaultMock.getDeltaAllocationTEST(protocolYearn.number),
      vaultMock.getDeltaAllocationTEST(protocolCompound.number),
      vaultMock.getDeltaAllocationTEST(protocolAave.number)
    ]);

    expect(yearn).to.be.equal(protocolYearn.allocation);
    expect(compound).to.be.equal(protocolCompound.allocation);
    expect(aave).to.be.equal(protocolAave.allocation);
  });

  it("Should deposit and rebalance", async function() {
    console.log('--------------depositing and rebalance with 100k ----------------')
    await setDeltaAllocations(vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();

    const balances = await getAndLogBalances(vaultMock, allProtocols);
    const allocations = await getAllocations(vaultMock, allProtocols);
    const totalAllocatedTokens = await vaultMock.totalAllocatedTokens();
    console.log(allocations)

    // Check if balanceInProtocol === currentAllocation / totalAllocated * amountDeposited
    allProtocols.forEach((protocol, i) => {
      expect(balances[i].div(1E6))
      .to.be.closeTo(allocations[i].mul(amountUSDC).div(totalAllocatedTokens).div(1E6), 5)
    })

    console.log('--------------rebalancing with amount 0----------------')
    protocolYearn.allocation = 40;
    protocolCompound.allocation = -20;
    protocolAave.allocation = -20;
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
    protocolYearn.allocation = -60;
    protocolCompound.allocation = 80;
    protocolAave.allocation = 40;
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

