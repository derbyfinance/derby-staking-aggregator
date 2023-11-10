import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { erc20, formatEther, formatUnits, parseEther, parseUnits } from '@testhelp/helpers';
import { allDAIVaults as protocols } from '@testhelp/addresses';
import { setupVault } from './setup';
import { VaultMock } from '@typechain';

describe('Testing Vault, unit test', async () => {
  const compoundVault = protocols.get('compound_dai_01')!;
  const yearnVault = protocols.get('yearn_dai_01')!;

  const amount = 100_000;

  const tests = [
    { protocol: compoundVault, priceScale: 18 },
    { protocol: yearnVault, priceScale: 18 },
  ];

  tests.forEach(({ protocol, priceScale }) => {
    describe(`Testing ${protocol.name}`, async () => {
      const LPToken: Contract = erc20(protocol.protocolToken);
      const decimals = protocol.decimals;

      let vault: VaultMock, user: Signer;

      before(async () => {
        const setup = await setupVault();
        vault = setup.vault;
        user = setup.user;
      });

      it(`Deposit funds into the vault and protocol`, async function () {
        await vault.connect(user).depositRequest(parseEther(amount));

        await vault.depositInProtocolTest(protocol.number, parseEther(10_000));
        const balanceUnderlying = formatEther(await vault.balanceUnderlying(protocol.number));

        // console.log({ balanceUnderlying });
        expect(balanceUnderlying).to.be.closeTo(10_000, 1);
      });

      it(`Verify expected shares match real balance after deposit`, async function () {
        const expectedShares = await vault.calcShares(protocol.number, parseEther(10_000));
        const realBalance = await LPToken.balanceOf(vault.address);

        // console.log({ expectedShares });
        // console.log({ realBalance });
        expect(formatUnits(expectedShares, decimals)).to.be.closeTo(
          formatUnits(realBalance, decimals),
          0.01,
        );
      });

      it(`Compare expected protocol price with actual price`, async function () {
        const expectedPrice = parseUnits(10_000, 18 + priceScale).div(
          await LPToken.balanceOf(vault.address),
        );
        const price = await vault.price(protocol.number);

        // console.log({ expectedPrice });
        // console.log({ price });
        expect(formatUnits(expectedPrice, priceScale)).to.be.closeTo(
          formatUnits(price, priceScale),
          0.0001,
        );
      });

      it(`Withdraw funds from the protocol`, async function () {
        await vault.withdrawFromProtocolTest(protocol.number, parseEther(2_000));
        const balanceUnderlying = formatEther(await vault.balanceUnderlying(protocol.number));

        // console.log({ balanceUnderlying });
        expect(balanceUnderlying).to.be.closeTo(10_000 - 2_000, 1);
      });

      it(`Verify expected shares match real balance after withdrawal`, async function () {
        const expectedShares = await vault.calcShares(protocol.number, parseEther(10_000 - 2_000));
        const realBalance = await LPToken.balanceOf(vault.address);

        // console.log({ expectedShares });
        // console.log({ realBalance });
        expect(formatUnits(expectedShares, decimals)).to.be.closeTo(
          formatUnits(realBalance, decimals),
          0.01,
        );
      });
    });
  });
});
