/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { ethers } from "hardhat";
import type { FeeTestContract} from '../typechain-types';
import { routerAddProtocol, erc20, getUSDCSigner } from "./helpers/helpers";
import { deployRouter, deployAaveProvider, deployCompoundProvider, deployYearnProvider } from "./helpers/deploy";
import { usdc, comptroller, compToken, aave, yearn, compoundUSDC, aaveUSDC, yearnUSDC, compoundDAI, aaveUSDT, usdt, dai } from "./helpers/addresses";
import { setDeltaAllocations, getAllocations, getAndLogBalances } from "./helpers/vaultHelpers";
import FeeTestContractArtifact from '../artifacts/contracts/Tests/FeeTestContract.sol/FeeTestContract.json';
import { deployContract } from "ethereum-waffle";
import { Signer, Contract } from "ethers";
import { formatUSDC, parseUSDC } from './helpers/helpers';
import type { ETFVaultMock, Router } from '../typechain-types';
import { beforeEachETFVault, Protocol } from "./helpers/vaultBeforeEach";

const deployFeeTestContract = (
  deployerSign: Signer, 
  name: string, 
  symbol: string, 
  decimals: number, 
  ETFname: string,
  ETFnumber: number,
  daoAddress: string,
  ETFGame: string, 
  router: string, 
  vaultCurrency: string, 
  uScale: number,
  gasFeeLiq: number,
  ) => deployContract(
    deployerSign, 
    FeeTestContractArtifact, 
    [name, symbol, decimals, ETFname, ETFnumber, daoAddress, ETFGame, router, vaultCurrency, uScale, gasFeeLiq]
  ) as Promise<FeeTestContract>;

const protocols = [
  [1, 30],
  [3, 10],
  [5, 20],
  [8, 50],
  [10, 20],
  [12, 30],
  [14, 10],
  [17, 20],
  [18, 30],
  [20, 60],
]

const name = 'DerbyUSDC';
const symbol = 'dUSDC';
const ETFname = 'USDC_med_risk';
const ETFnumber = 0;
const decimals = 6;
const uScale = 1E6;
const amount = 10000000;
const amountUSDC = parseUSDC(amount.toString());
const gasFeeLiquidity = 10_000 * uScale;

describe("Test gas", async () => {
  let feeTestContract: FeeTestContract, dao: Signer;
  
  beforeEach(async function() {
    const [dao, user] = await ethers.getSigners();

    // Get Addresses
    const [daoAddr, userAddr] = await Promise.all([
      dao.getAddress(),
      user.getAddress(),
    ]);
    const router = await deployRouter(dao, daoAddr);
    feeTestContract = await deployFeeTestContract(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, router.address, usdc, uScale, gasFeeLiquidity)
  });

  it("set and read array", async function() {
    await feeTestContract.deleteArray();

    for (const protocol of protocols) {
      await feeTestContract.setMapping(protocol[0], protocol[1])
    }
    
    for (const protocol of protocols) {
      await feeTestContract.setArray(protocol[0]);
    }

    await feeTestContract.loopArray();
  });

  it("set mapping", async function() {
    for (const protocol of protocols) {
      await feeTestContract.setMapping(protocol[0], protocol[1])
    }
    await feeTestContract.setLatestProtol(20);

    await feeTestContract.loopMapping();
  });

  it("set protocolsInETF array", async function() {
    const latestProtocol = await feeTestContract.latestProtocol();
    console.log(`latest ${latestProtocol}`);
  });
  
});

describe.skip("Simulate looping through game players and calculating weighted average price", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolAave: Protocol,
  protocolYearn: Protocol,
  protocolCompoundDAI: Protocol,
  protocolAaveUSDT: Protocol,
  allProtocols: Protocol[],
  router: Router;

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn, protocolCompoundDAI, protocolAaveUSDT],
      allProtocols,
      IUSDc,,,,,
      router,,,,,,,
      dao
    ] = await beforeEachETFVault(amountUSDC)
  });

  it("Can loop through all game players and calculate the price of their baskets", async function() {
    let yearnProvider, compoundProvider, aaveProvider;

    [compoundProvider, aaveProvider, yearnProvider] = await Promise.all([
      deployCompoundProvider(dao, router.address, comptroller),
      deployAaveProvider(dao, router.address),
      deployYearnProvider(dao, router.address),
    ]);

    // loop 9 times, so in total there are 25 protocols in the vault
    const protocols = [protocolCompound, protocolAave, protocolYearn, protocolCompoundDAI, protocolAaveUSDT];
    let p: Protocol;
    for (let i = 1; i < 5; i++) {
      await Promise.all([
        routerAddProtocol(router, 'compound_usdc_01', ETFnumber, compoundProvider.address, compoundUSDC, usdc, compToken, 1E6.toString()),
        routerAddProtocol(router, 'compound_dai_01', ETFnumber, compoundProvider.address, compoundDAI, dai, compToken, 1E18.toString()),
        routerAddProtocol(router, 'aave_usdc_01', ETFnumber, aaveProvider.address, aaveUSDC, usdc, aave, 1E6.toString()),
        routerAddProtocol(router, 'aave_usdt_01', ETFnumber, aaveProvider.address, aaveUSDT, usdt, aave, 1E6.toString()),
        routerAddProtocol(router, 'yearn_usdc_01', ETFnumber, yearnProvider.address, yearnUSDC, usdc, yearn, 1E6.toString()),
      ]);
      for (let j = i*5; j < i*5+5; j++){
        p = { number: j, allocation: j*10, address:  compoundProvider.address };
        protocols.push(p);
      }
    }

    console.log("Number of protocols in vault: %s", await router.latestProtocolId(ETFnumber));

    await setDeltaAllocations(user, vaultMock, protocols);
    await vaultMock.depositETF(userAddr, amountUSDC);
    await vaultMock.rebalanceETF();
    console.log("total alloc: %s", await vaultMock.totalAllocatedTokens());

    const [allocations, balances] = await Promise.all([
      getAllocations(vaultMock, protocols),
      getAndLogBalances(vaultMock, protocols)
    ]);

    protocols.forEach((protocol, i) => {
      console.log("allocation: %s, balance: %s", allocations[i], balances[i]);
    });

    await vaultMock.testLargeGameplayerSet(1);

  });
})