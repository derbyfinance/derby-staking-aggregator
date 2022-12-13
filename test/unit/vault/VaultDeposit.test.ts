import { expect } from 'chai';
import { setupVault } from './setup';

describe.only('Testing VaultDeposit, unit test', async () => {
  it('Deposit, mint and return Derby LP tokens', async function () {
    const { vault, user } = await setupVault();
    await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
      vault,
      user,
      10_000 * 1e6,
    );

    // mocking exchangerate to 0.9
    await vault.setExchangeRateTEST(0.9 * 1e6);

    let expectedLPTokens = Math.trunc((10_000 / 0.9) * 1e6);
    await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
      vault,
      user,
      expectedLPTokens,
    );

    // mocking exchangerate to 1.321
    await vault.setExchangeRateTEST(1.321 * 1e6);

    expectedLPTokens = Math.trunc((10_000 / 1.321) * 1e6);
    await expect(() => vault.connect(user).deposit(10_000 * 1e6)).to.changeTokenBalance(
      vault,
      user,
      expectedLPTokens,
    );
  });

  it('Should not be able to deposit when vault is off', async function () {
    const { vault, user } = await setupVault();
    await vault.toggleVaultOnOffTEST(true);

    await expect(vault.connect(user).deposit(10_000 * 1e6)).to.be.revertedWith('Vault is off');
  });
});
