/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { ethers } from "hardhat";
import type { FeeTestContract} from '../../typechain-types';
import { controllerAddProtocol, erc20, getUSDCSigner } from "../helpers/helpers";
import { deployController, deployETFVaultMock } from "../helpers/deploy";
import { usdc, compToken, aave, yearn, compoundUSDC, aaveUSDC, yearnUSDC, compoundDAI, aaveUSDT, usdt, dai } from "../helpers/addresses";
import { setDeltaAllocations, getAllocations, getAndLogBalances } from "../helpers/vaultHelpers";
import FeeTestContractArtifact from '../../artifacts/contracts/Tests/FeeTestContract.sol/FeeTestContract.json';
import { deployContract } from "ethereum-waffle";
import { Signer, Contract } from "ethers";
import { formatUSDC, parseUSDC } from '../helpers/helpers';
import type { ETFVaultMock, Controller } from '../../typechain-types';
import allProviders  from "../helpers/allProvidersClass";

interface Protocol {
  number: number;
  allocation: number;
  address: string;
}

const deployFeeTestContract = (
  deployerSign: Signer, 
  name: string, 
  symbol: string, 
  decimals: number, 
  ETFname: string,
  ETFnumber: number,
  daoAddress: string,
  ETFGame: string, 
  controller: string, 
  vaultCurrency: string, 
  uScale: number,
  gasFeeLiq: number,
  ) => deployContract(
    deployerSign, 
    FeeTestContractArtifact, 
    [name, symbol, decimals, ETFname, ETFnumber, daoAddress, ETFGame, controller, vaultCurrency, uScale, gasFeeLiq]
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

const name = 'XaverUSDC';
const symbol = 'dUSDC';
const ETFname = 'USDC_med_risk';
const ETFnumber = 0;
const decimals = 6;
const uScale = 1E6;
const amount = 10000000;
const amountUSDC = parseUSDC(amount.toString());
const gasFeeLiquidity = 10_000 * uScale;

describe.skip("Testing feeTest, gas", async () => {
  let feeTestContract: FeeTestContract, dao: Signer;
  
  beforeEach(async function() {
    const [dao, user] = await ethers.getSigners();

    // Get Addresses
    const [daoAddr, userAddr] = await Promise.all([
      dao.getAddress(),
      user.getAddress(),
    ]);
    const controller = await deployController(dao, daoAddr);
    feeTestContract = await deployFeeTestContract(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity)
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

describe.skip("Testing feeTest. Simulate looping through game players and calculating weighted average price", async () => {
  let vault: ETFVaultMock, controller: Controller, dao: Signer, user: Signer, USDCSigner: Signer, IUSDc: Contract, daoAddr: string, userAddr: string;

  beforeEach(async function() {
    [dao, user] = await ethers.getSigners();

    [USDCSigner, IUSDc, daoAddr, userAddr] = await Promise.all([
      getUSDCSigner(),
      erc20(usdc),
      dao.getAddress(),
      user.getAddress()
    ]);

    controller = await deployController(dao, daoAddr);
    vault = await deployETFVaultMock(dao, name, symbol, decimals, ETFname, ETFnumber, daoAddr, userAddr, controller.address, usdc, uScale, gasFeeLiquidity);

    await Promise.all([
      allProviders.deployAllProviders(dao, controller),
      IUSDc.connect(USDCSigner).transfer(userAddr, amountUSDC),
      IUSDc.connect(user).approve(vault.address, amountUSDC),
    ]);
  });

  it("Can loop through all game players and calculate the price of their baskets", async function() {
  const { yearnProvider, compoundProvider, aaveProvider } = allProviders;

  const protocolCompound = { number: 0, allocation: 40, address: compoundUSDC };
  const protocolAave = { number: 0, allocation: 60, address: aaveUSDC };
  const protocolYearn = { number: 0, allocation: 20, address: yearnUSDC };
  const protocolCompoundDAI = { number: 0, allocation: 0, address: compoundDAI };
  const protocolAaveUSDT = { number: 0, allocation: 0, address: aaveUSDT };

    // loop 9 times, so in total there are 25 protocols in the vault
    const protocols = [protocolCompound, protocolAave, protocolYearn, protocolCompoundDAI, protocolAaveUSDT];
    let p: Protocol;
    for (let i = 1; i < 5; i++) {
      await Promise.all([
        controllerAddProtocol(controller, 'compound_usdc_01', ETFnumber, compoundProvider.address, compoundUSDC, usdc, compToken, 1E6.toString()),
        controllerAddProtocol(controller, 'compound_dai_01', ETFnumber, compoundProvider.address, compoundDAI, dai, compToken, 1E18.toString()),
        controllerAddProtocol(controller, 'aave_usdc_01', ETFnumber, aaveProvider.address, aaveUSDC, usdc, aave, 1E6.toString()),
        controllerAddProtocol(controller, 'aave_usdt_01', ETFnumber, aaveProvider.address, aaveUSDT, usdt, aave, 1E6.toString()),
        controllerAddProtocol(controller, 'yearn_usdc_01', ETFnumber, yearnProvider.address, yearnUSDC, usdc, yearn, 1E6.toString()),
      ]);
      for (let j = i*5; j < i*5+5; j++){
        p = { number: j, allocation: j*10, address:  compoundProvider.address };
        protocols.push(p);
      }
    }

    console.log("Number of protocols in vault: %s", await controller.latestProtocolId(ETFnumber));

    await setDeltaAllocations(user, vault, protocols);
    await vault.connect(user).depositETF(amountUSDC);
    await vault.rebalanceETF();
    console.log("total alloc: %s", await vault.totalAllocatedTokens());

    const [allocations, balances] = await Promise.all([
      getAllocations(vault, protocols),
      getAndLogBalances(vault, protocols)
    ]);

    protocols.forEach((protocol, i) => {
      console.log("allocation: %s, balance: %s", allocations[i], balances[i]);
    });

    await vault.testLargeGameplayerSet(1);

  });
})