import { expect } from 'chai';
import { Contract } from 'ethers';
import { erc20, parseEther, parseUnits } from '@testhelp/helpers';
import { dai } from '@testhelp/addresses';
import { setupVault } from './setup';
import { run } from 'hardhat';

describe('Testing VaultWithdraw, unit test', async () => {
  const IUSDc: Contract = erc20(dai);

  it('Should set withdrawal request and withdraw the allowance later', async function () {
    const { vault, user } = await setupVault();
    await vault.connect(user).depositRequest(parseEther(10_000)); // 10k

    // Rebalancing Period == 0, should not be able to withdraw
    await expect(vault.connect(user).withdrawalRequest(parseEther(100))).to.be.revertedWith(
      'Already a request',
    );

    await vault.upRebalancingPeriodTEST();
    await vault.connect(user).redeemDeposit();

    expect(await vault.totalSupply()).to.be.equal(parseUnits(10_000, 6)); // 10k LP tokens with decimals 6

    // mocking exchangerate to 0.9
    await vault.setExchangeRateTEST(parseEther(0.9));

    await vault.upRebalancingPeriodTEST();

    // withdrawal request for more then LP token balance
    await expect(vault.connect(user).withdrawalRequest(parseEther(9_001))).to.be.revertedWith(
      'Max divergence',
    );

    // withdrawal request for 10k LP tokens
    await expect(() =>
      vault.connect(user).withdrawalRequest(parseEther(9_000)),
    ).to.changeTokenBalance(vault, user, -parseUnits(10_000, 6));

    // check withdrawalAllowance user and totalsupply
    expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(parseEther(9_000));
    expect(await vault.totalSupply()).to.be.equal(parseEther(0));

    // trying to withdraw allowance before the vault reserved the funds
    await expect(vault.connect(user).withdrawAllowance()).to.be.revertedWith('');

    // mocking vault settings
    await vault.upRebalancingPeriodTEST();
    await vault.setTotalWithdrawalRequestsTEST(parseEther(10_000));

    // withdraw allowance should give 9k USDC
    await expect(() => vault.connect(user).withdrawAllowance()).to.changeTokenBalance(
      IUSDc,
      user,
      parseEther(9_000),
    );

    // trying to withdraw allowance again
    await expect(vault.connect(user).withdrawAllowance()).to.be.revertedWith('!Allowance');
  });

  describe('Testing governance fee', async () => {
    it('Should send governance fee to dao on withdraw allowance function', async function () {
      const { vault, user, dao, contract } = await setupVault();
      await run('vault_set_governance_fee', { contract: contract, fee: 50 });
      await vault.upRebalancingPeriodTEST();

      await vault.connect(user).depositRequest(parseEther(20_000));
      await vault.upRebalancingPeriodTEST();
      await vault.connect(user).redeemDeposit();

      // withdrawal request for 20k LP tokens
      await expect(() =>
        vault.connect(user).withdrawalRequest(parseEther(20_000)),
      ).to.changeTokenBalance(vault, user, -parseUnits(20_000, 6));

      // mocking vault settings
      await vault.upRebalancingPeriodTEST();
      await vault.setTotalWithdrawalRequestsTEST(parseEther(20_000));
      const govFee = 20_000 * 0.005;

      // withdraw allowance should give 9k USDC
      await expect(() => vault.connect(user).withdrawAllowance()).to.changeTokenBalance(
        IUSDc,
        user,
        parseEther((20_000 - govFee)),
      );

      expect(await IUSDc.balanceOf(dao.address)).to.be.equal(parseEther(govFee));
    });
  });
});
