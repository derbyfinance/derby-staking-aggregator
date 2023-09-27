import { expect } from 'chai';
import { Contract } from 'ethers';
import { erc20, parseUSDC } from '@testhelp/helpers';
import { usdc } from '@testhelp/addresses';
import { setupVault } from './setup';
import { run } from 'hardhat';

describe('Testing VaultWithdraw, unit test', async () => {
  const IUSDc: Contract = erc20(usdc);

  it('Should set withdrawal request and withdraw the allowance later', async function () {
    const { vault, user } = await setupVault();
    await vault.connect(user).depositRequest(parseUSDC(10_000)); // 10k

    // Rebalancing Period == 0, should not be able to withdraw
    await expect(vault.connect(user).withdrawalRequest(parseUSDC(100))).to.be.revertedWith(
      'Already a request',
    );

    await vault.upRebalancingPeriodTEST();
    await vault.connect(user).redeemDeposit();

    expect(await vault.totalSupply()).to.be.equal(parseUSDC(10_000)); // 10k

    // mocking exchangerate to 0.9
    await vault.setExchangeRateTEST(parseUSDC(0.9));

    await vault.upRebalancingPeriodTEST();

    // withdrawal request for more then LP token balance
    await expect(vault.connect(user).withdrawalRequest(parseUSDC(10_001))).to.be.revertedWith(
      'ERC20: burn amount exceeds balance',
    );

    // withdrawal request for 10k LP tokens
    await expect(() =>
      vault.connect(user).withdrawalRequest(parseUSDC(10_000)),
    ).to.changeTokenBalance(vault, user, -parseUSDC(10_000));

    // check withdrawalAllowance user and totalsupply
    expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(parseUSDC(9_000));
    expect(await vault.totalSupply()).to.be.equal(parseUSDC(0));

    // trying to withdraw allowance before the vault reserved the funds
    await expect(vault.connect(user).withdrawAllowance()).to.be.revertedWith('');

    // mocking vault settings
    await vault.upRebalancingPeriodTEST();
    await vault.setTotalWithdrawalRequestsTEST(parseUSDC(10_000));

    // withdraw allowance should give 9k USDC
    await expect(() => vault.connect(user).withdrawAllowance()).to.changeTokenBalance(
      IUSDc,
      user,
      parseUSDC(9_000 * 0.9945),
    );

    // trying to withdraw allowance again
    await expect(vault.connect(user).withdrawAllowance()).to.be.revertedWith('!Allowance');
  });

  describe('Testing governance fee', async () => {
    it('Should send governance fee to dao on withdraw allowance function', async function () {
      const { vault, user, dao, contract } = await setupVault();
      await run('vault_set_governance_fee', { contract: contract, fee: 50 });
      await vault.upRebalancingPeriodTEST();

      await vault.connect(user).depositRequest(parseUSDC(20_000));
      await vault.upRebalancingPeriodTEST();
      await vault.connect(user).redeemDeposit();

      // withdrawal request for 20k LP tokens
      await expect(() =>
        vault.connect(user).withdrawalRequest(parseUSDC(20_000)),
      ).to.changeTokenBalance(vault, user, -parseUSDC(20_000));

      // mocking vault settings
      await vault.upRebalancingPeriodTEST();
      await vault.setTotalWithdrawalRequestsTEST(parseUSDC(20_000));
      const govFee = 20_000 * 0.005;

      // withdraw allowance should give 9k USDC
      await expect(() => vault.connect(user).withdrawAllowance()).to.changeTokenBalance(
        IUSDc,
        user,
        parseUSDC((20_000 - govFee) * 0.9945),
      );

      expect(await IUSDc.balanceOf(dao.address)).to.be.equal(parseUSDC(govFee * 0.9945));
    });
  });
});
