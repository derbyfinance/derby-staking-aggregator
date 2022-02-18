/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import chai, { expect } from "chai";
import { Signer, Wallet, utils, Contract } from "ethers";
import { ethers, waffle } from "hardhat";
import { getUSDCSigner, erc20, formatUSDC, parseUSDC, } from './helpers/helpers';
import type { YearnProvider, CompoundProvider, AaveProvider, ETFVaultMock, ERC20, Router } from '../typechain-types';
import { deployRouter, deployETFVaultMock } from './helpers/deploy';
import { addProtocolsToRouter, deployAllProviders, getAllocations, getAndLogBalances, setDeltaAllocations } from "./helpers/vaultHelpers";
import { usdc, yearnUSDC as yusdc, compoundUSDC as cusdc, aaveUSDC as ausdc} from "./helpers/addresses";

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
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
    [vaultMock, USDCSigner, IUSDc, [yearnProvider, compoundProvider, aaveProvider]] = await Promise.all([
      deployETFVaultMock(dao, name, symbol, decimals, daoAddr, ETFNumber, router.address, usdc, threshold),
      getUSDCSigner(),
      erc20(usdc),
      deployAllProviders(dao, router, allProtocols)
    ]);
    
    // Transfer USDC to user(ETFGame) and set protocols in Router
    await Promise.all([
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vaultMock.address, amountUSDC),
      addProtocolsToRouter(ETFNumber, router, vaultMock.address, allProtocols, [yearnProvider, compoundProvider, aaveProvider])
    ]);
  });

  it("Should deposit and withdraw in order from protocols", async function() {
    await setDeltaAllocations(vaultMock, allProtocols);

    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();

    console.log(formatUSDC(await vaultMock.balanceOf(userAddr)));
    console.log(formatUSDC(await IUSDc.balanceOf(userAddr)));

    await vaultMock.withdrawETF(userAddr, parseUSDC('20000'));

    console.log(formatUSDC(await vaultMock.balanceOf(userAddr)));
    console.log(formatUSDC(await IUSDc.balanceOf(userAddr)));

    // const balances = await getAndLogBalances(vaultMock, allProtocols);
    // const allocations = await getAllocations(vaultMock, allProtocols);
    // const totalAllocatedTokens = await vaultMock.totalAllocatedTokens();

  });

});

