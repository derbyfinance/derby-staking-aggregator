import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { erc20, formatUSDC, formatUnits, parseUSDC, parseUnits } from '@testhelp/helpers';
import { allProtocols as protocols } from '@testhelp/addresses';
import { setupVault } from './setup';
import { MainVaultMock } from '@typechain';

describe('Testing Vault, unit test', async () => {
  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;
  const truefiVault = protocols.get('truefi_usdc_01')!;
  const idleVault = protocols.get('idle_usdc_01')!;
  const betaVault = protocols.get('beta_usdc_01');

  const amount = 100_000;

  const tests = [
    // { protocol: compoundVault, priceScale: 18 },
    // { protocol: aaveVault, priceScale: 0 },
    // { protocol: yearnVault, priceScale: 6 },
    // { protocol: truefiVault, priceScale: 6 },
    { protocol: idleVault, priceScale: 6 },
  ];

  tests.forEach(({ protocol, priceScale }) => {
    describe(`Testing ${protocol.name}`, async () => {
      const LPToken: Contract = erc20(protocol.protocolToken);
      const decimals = protocol.decimals;

      let vault: MainVaultMock, user: Signer;

      before(async () => {
        const setup = await setupVault();
        vault = setup.vault;
        user = setup.user;
      });

      it(`Deposit funds into the vault and protocol`, async function () {
        await vault.connect(user).deposit(parseUSDC(amount), await user.getAddress());

        await vault.depositInProtocolTest(protocol.number, parseUSDC(10_000));
        const balanceUnderlying = formatUSDC(await vault.balanceUnderlying(protocol.number));
        expect(balanceUnderlying).to.be.closeTo(10_000, 1);
      });

      it(`Verify expected shares match real balance after deposit`, async function () {
        const expectedShares = await vault.calcShares(protocol.number, parseUSDC(10_000));
        const realBalance = await LPToken.balanceOf(vault.address);
        console.log(formatUnits(expectedShares, decimals));
        console.log(formatUnits(realBalance, decimals));
        expect(formatUnits(expectedShares, decimals)).to.be.closeTo(
          formatUnits(realBalance, decimals),
          0.01,
        );
      });

      it(`Compare expected protocol price with actual price`, async function () {
        const expectedPrice = parseUnits(10_000, 6 + priceScale).div(
          await LPToken.balanceOf(vault.address),
        );
        const price = await vault.price(protocol.number);
        console.log({ expectedPrice });
        console.log({ price });
        console.log(formatUnits(expectedPrice, decimals));
        console.log(formatUnits(price, decimals));
        expect(formatUnits(expectedPrice, decimals)).to.be.closeTo(
          formatUnits(price, decimals),
          0.0001,
        );
      });

      it(`Withdraw funds from the protocol`, async function () {
        await vault.withdrawFromProtocolTest(protocol.number, parseUSDC(2_000));
        const balanceUnderlying = formatUSDC(await vault.balanceUnderlying(protocol.number));
        expect(balanceUnderlying).to.be.closeTo(10_000 - 2_000, 1);
      });

      it(`Verify expected shares match real balance after withdrawal`, async function () {
        const expectedShares = await vault.calcShares(protocol.number, parseUSDC(10_000 - 2_000));
        const realBalance = await LPToken.balanceOf(vault.address);
        console.log(formatUnits(expectedShares, decimals));
        console.log(formatUnits(realBalance, decimals));
        expect(formatUnits(expectedShares, decimals)).to.be.closeTo(
          formatUnits(realBalance, decimals),
          0.01,
        );
      });
    });
  });
});
// 99999999
