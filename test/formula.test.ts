import { expect } from 'chai';
import { Signer, Contract } from 'ethers';
import { formatUSDC, parseUSDC } from '@testhelp/helpers';
import type { MainVaultMock } from '@typechain';
import { vaultInfo } from '@testhelp/vaultHelpers';

const amount = 100_000;
const amountUSDC = parseUSDC(amount.toString());
const { name, symbol, decimals, ETFname, vaultNumber, uScale, gasFeeLiquidity } = vaultInfo;

// skipping Vault test for now
describe.skip('Deploy Contracts and interact with Vault', async () => {
  let vaultMock: MainVaultMock,
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
});
