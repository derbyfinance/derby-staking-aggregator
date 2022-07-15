/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { formatUSDC, parseUSDC } from './helpers/helpers';
import type { VaultMock } from '../typechain-types';
import { vaultInfo } from "./helpers/vaultHelpers";

const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, ETFnumber, uScale, gasFeeLiquidity } = vaultInfo;

// skipping Vault test for now
describe.skip("Deploy Contracts and interact with Vault", async () => {
  let vaultMock: VaultMock,
  user: Signer,
  dao: Signer,
  userAddr: string,
  IUSDc: Contract, 
  router: Contract;

  // beforeEach(async function() {
  //   [
  //     vaultMock,
  //     user,
  //     userAddr,
  //     [protocolCompound, protocolAave, protocolYearn],
  //     allProtocols,
  //     IUSDc,,,,,
  //     router,,,,,,,
  //     dao
  //   ] = await beforeEachVault(amountUSDC)
  // });

  // it("Calulates the n root correctly", async function() {
  //   let n = 28, g = 5.33915E19;
  //   let output = await vaultMock.testFormulaWithNRoot(g.toString(), n.toString());
  //   console.log("output: %s", output);
  // });
})