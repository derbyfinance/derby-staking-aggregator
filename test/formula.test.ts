/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect, assert } from "chai";
import { Signer, Contract, BigNumber } from "ethers";
import { formatUSDC, parseUSDC } from './helpers/helpers';
import type { ETFVaultMock } from '../typechain-types';
import { getAllocations, getAndLogBalances, rebalanceETF, setDeltaAllocations } from "./helpers/vaultHelpers";
import { beforeEachETFVault, Protocol } from "./helpers/vaultBeforeEach";


const name = 'XaverUSDC';
const symbol = 'dUSDC';
const decimals = 6;
const marginScale = 1E9;
const uScale = 1E6;
const liquidityPerc = 10;
const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());

// skipping ETFVault test for now
describe.skip("Deploy Contracts and interact with Vault", async () => {
  let vaultMock: ETFVaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  protocolCompound: Protocol,
  protocolAave: Protocol,
  protocolYearn: Protocol,
  allProtocols: Protocol[],
  router: Contract;

  beforeEach(async function() {
    [
      vaultMock,
      user,
      userAddr,
      [protocolCompound, protocolAave, protocolYearn],
      allProtocols,
      IUSDc,,,,,
      router,,,,,,,
      dao
    ] = await beforeEachETFVault(amountUSDC)
  });

  it("Calulates the n root correctly", async function() {
    let n = 28, g = 5.33915E19;
    let output = await vaultMock.testFormulaWithNRoot(g.toString(), n.toString());
    console.log("output: %s", output);
  });
})